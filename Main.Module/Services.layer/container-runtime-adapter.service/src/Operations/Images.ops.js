/*
    Operações de IMAGEM (CTMG-36).

    Listar, inspecionar, remover, exportar e construir. O ciclo de vida que
    ainda falta — baixar, enviar, etiquetar, histórico, busca e detecção de
    versão nova — entra aqui (CTMG-45 a CTMG-48).
*/

const { PassThrough } = require('node:stream')

// TAR mínimo escrito à mão — a API do Docker só troca arquivo com container por
// TAR, e este pacote tem uma dependência declarada só (VDRP-260).
const { BuildTarWithSingleFile } = require("../Helpers/TarSingleFile")
const NormalizeDockerFilters = require("../Helpers/NormalizeDockerFilters")
const BuildPruneOptions = require("../Helpers/BuildPruneOptions")

const BuildFilterOption = (filters) => {
    const normalizados = NormalizeDockerFilters(filters)
    return normalizados === undefined ? {} : { filters: normalizados }
}

const CreateImageOperations = ({ docker, StreamToBuffer, SafeFileName }) => {

    /*
        Chamada sem argumento mantém o comportamento de antes (CTMG-41).
        `filters` aceita reference, label, dangling, before, since.
    */
    const ListAllImages = async ({ all, filters } = {}) => {
        try {
            const images = await docker.listImages({
                ...(all !== undefined ? { all: Boolean(all) } : {}),
                ...BuildFilterOption(filters)
            })
            return images
        }
        catch (error) {
            console.error('Error listing images:', error)
            throw error
        }

    }

    const InspectImage = async (imageIdOrName) => {
        try {
            const image = docker.getImage(imageIdOrName)
            const imageInfo = await image.inspect()
            return imageInfo
        } catch (error) {
            console.error(`Error inspecting image ${imageIdOrName}:`, error)
            throw error
        }
    }

    const RemoveImage = async ({ imageIdOrName, force = false }) => {
        try {
            const image = docker.getImage(imageIdOrName)
            await image.remove({ force })
            return { success: true, message: `Image ${imageIdOrName} removed successfully` }
        } catch (error) {
            console.error(`Error removing image ${imageIdOrName}:`, error)
            throw error
        }
    }

    // Exporta uma imagem (equivalente a `docker save`) — retorna um tar em base64.
    // ATENÇÃO: o tar inteiro é carregado em memória (limitação do contrato JSON
    // do controller). Imagens muito grandes podem consumir bastante memória.
    const ExportImage = async (imageIdOrName) => {
        try {
            const image = docker.getImage(imageIdOrName)
            const stream = await image.get()
            const buffer = await StreamToBuffer(stream, { descricao: "A imagem exportada" })
            return {
                isBase64 : true,
                fileName : `${SafeFileName(imageIdOrName, "image")}.tar`,
                mimeType : "application/x-tar",
                data     : buffer.toString("base64")
            }
        } catch (error) {
            console.error(`Error exporting image ${imageIdOrName}:`, error)
            throw error
        }
    }

    /*
        BAIXAR IMAGEM (CTMG-45) — a lacuna número 1 do produto.

        Sem isto o app só gerencia o que já está na máquina, e criar um
        container a partir de uma imagem ausente falha com "no such image".

        A REGRA CRÍTICA É `followProgress`. `docker.pull` devolve um stream e a
        promessa resolve assim que ele ABRE — não quando o download termina.
        Sem seguir o progresso até o fim, a operação "termina" com a imagem
        pela metade e o container seguinte falha por um motivo que não tem
        nada a ver com o erro que aparece. O único uso anterior no pacote
        (EnsureVolumeExportImage) já fazia certo, e serve de modelo.
    */
    const PullImage = async ({ reference, platform, auth, onProgress }) => {
        if (typeof reference !== "string" || reference.trim() === "") {
            const erro = new Error("Informe a referência da imagem, ex.: postgres:16.")
            erro.code = "INVALID_IMAGE_REFERENCE"
            erro.httpStatus = 400
            erro.statusCode = 400
            throw erro
        }

        const referencia = reference.trim()

        await new Promise((resolve, reject) => {
            const opcoes = {
                ...(auth ? { authconfig: auth } : {}),
                ...(platform ? { platform } : {})
            }

            docker.pull(referencia, opcoes, (erro, stream) => {
                if (erro) {
                    /*
                        Tag inexistente e registry sem autorização chegam por
                        AQUI (404/401 do modem), não pelo fluxo. Sem carimbar o
                        código, quem chama recebe um erro com forma diferente
                        conforme onde a falha aconteceu — e a tela precisaria
                        de dois tratamentos para o mesmo problema.
                    */
                    erro.code = erro.code || "IMAGE_PULL_FAILED"
                    return reject(erro)
                }

                docker.modem.followProgress(
                    stream,
                    (falha, saida) => {
                        if (falha) return reject(falha)

                        /*
                            Mesmo com followProgress, um erro de camada chega
                            como EVENTO dentro da saída, não como exceção — o
                            mesmo padrão do build (VDRP-269). Sem olhar por
                            ele, um pull de tag inexistente "termina bem".
                        */
                        const evento = (saida || []).find((linha) => linha && linha.error)
                        if (evento) {
                            const falhaDeCamada = new Error(
                                `Falha ao baixar ${referencia}: ${evento.error}`
                            )
                            falhaDeCamada.code = "IMAGE_PULL_FAILED"
                            return reject(falhaDeCamada)
                        }

                        resolve()
                    },
                    (evento) => {
                        if (typeof onProgress !== "function") return
                        onProgress({
                            id: evento.id,
                            status: evento.status,
                            current: evento.progressDetail?.current ?? null,
                            total: evento.progressDetail?.total ?? null
                        })
                    }
                )
            })
        })

        return await docker.getImage(referencia).inspect()
    }

    /*
        ENVIAR IMAGEM (CTMG-46).

        Mesmo cuidado do pull: o erro de autenticação vem no fluxo, não como
        exceção. Um push sem credencial válida "termina" e a imagem não está
        no registry.
    */
    const PushImage = async ({ reference, tag, auth, onProgress }) => {
        const imagem = docker.getImage(reference)

        await new Promise((resolve, reject) => {
            imagem.push(
                {
                    ...(tag ? { tag } : {}),
                    ...(auth ? { authconfig: auth } : {})
                },
                (erro, stream) => {
                    if (erro) return reject(erro)

                    docker.modem.followProgress(
                        stream,
                        (falha, saida) => {
                            if (falha) return reject(falha)

                            const evento = (saida || []).find((linha) => linha && linha.error)
                            if (evento) {
                                const falhaDeEnvio = new Error(
                                    `Falha ao enviar ${reference}: ${evento.error}`
                                )
                                falhaDeEnvio.code = "IMAGE_PUSH_FAILED"
                                return reject(falhaDeEnvio)
                            }

                            resolve()
                        },
                        (evento) => {
                            if (typeof onProgress !== "function") return
                            onProgress({
                                id: evento.id,
                                status: evento.status,
                                current: evento.progressDetail?.current ?? null,
                                total: evento.progressDetail?.total ?? null
                            })
                        }
                    )
                }
            )
        })

        return { success: true, message: `Image ${reference} pushed successfully` }
    }

    const TagImage = async ({ imageIdOrName, repo, tag }) => {
        if (!repo) {
            const erro = new Error("Informe o repositório de destino, ex.: meu/app.")
            erro.code = "INVALID_IMAGE_REPO"
            erro.httpStatus = 400
            erro.statusCode = 400
            throw erro
        }

        try {
            await docker.getImage(imageIdOrName).tag({ repo, ...(tag ? { tag } : {}) })
            return {
                success: true,
                message: `Image ${imageIdOrName} tagged as ${repo}${tag ? ":" + tag : ""}`
            }
        } catch (error) {
            console.error(`Error tagging image ${imageIdOrName}:`, error)
            throw error
        }
    }

    /*
        COMO A IMAGEM FOI CONSTRUÍDA (CTMG-46).

        Cada camada com o comando que a criou e o quanto ela pesa — a resposta
        para "por que esta imagem tem 1,2 GB".
    */
    const GetImageHistory = async (imageIdOrName) => {
        try {
            const historico = await docker.getImage(imageIdOrName).history()
            return (historico || []).map((camada) => ({
                id: camada.Id,
                created: camada.Created,
                createdBy: camada.CreatedBy,
                size: camada.Size,
                comment: camada.Comment,
                tags: camada.Tags || []
            }))
        } catch (error) {
            console.error(`Error reading history of image ${imageIdOrName}:`, error)
            throw error
        }
    }

    const SearchImages = async ({ term, limit, filters } = {}) => {
        if (!term) {
            const erro = new Error("Informe o termo da busca.")
            erro.code = "INVALID_SEARCH_TERM"
            erro.httpStatus = 400
            erro.statusCode = 400
            throw erro
        }

        try {
            const resultados = await docker.searchImages({
                term,
                ...(limit ? { limit: Number(limit) } : {}),
                ...BuildFilterOption(filters)
            })

            return (resultados || []).map((item) => ({
                name: item.name,
                description: item.description,
                stars: item.star_count,
                official: Boolean(item.is_official),
                automated: Boolean(item.is_automated)
            }))
        } catch (error) {
            console.error(`Error searching images for "${term}":`, error)
            throw error
        }
    }

    /*
        VALIDAR CREDENCIAL DE REGISTRY (CTMG-47).

        Existe para que o cadastro de registry possa ter um botão "testar" —
        descobrir que a senha está errada na hora do push, no meio de uma
        entrega, é o pior momento possível.
    */
    const RegistryLogin = async ({ serverAddress, username, password, email }) => {
        try {
            const resposta = await docker.checkAuth({
                username,
                password,
                ...(email ? { email } : {}),
                ...(serverAddress ? { serveraddress: serverAddress } : {})
            })
            return {
                ok: true,
                status: resposta?.Status || "Login Succeeded",
                identityToken: resposta?.IdentityToken || null
            }
        } catch (error) {
            /*
                Credencial errada é RESPOSTA, não exceção: a tela precisa
                mostrar "não autenticado" sem tratar erro linha a linha, do
                mesmo jeito que TestConnection faz com runtime fora do ar.
            */
            return {
                ok: false,
                status: error?.json?.message || error.message,
                statusCode: error?.statusCode ?? null
            }
        }
    }

    /*
        CARREGAR IMAGEM DE ARQUIVO (CTMG-47) — a volta do ExportImage, que
        existia sem par desde sempre.
    */
    const LoadImage = async ({ contentBase64, onProgress }) => {
        if (!contentBase64) {
            const erro = new Error("Informe o conteúdo do arquivo tar da imagem.")
            erro.code = "INVALID_IMAGE_CONTENT"
            erro.httpStatus = 400
            erro.statusCode = 400
            throw erro
        }

        const tar = Buffer.from(contentBase64, "base64")
        const fluxo = new PassThrough()
        fluxo.end(tar)

        const saida = await new Promise((resolve, reject) => {
            docker.loadImage(fluxo, {}, (erro, stream) => {
                if (erro) return reject(erro)

                docker.modem.followProgress(
                    stream,
                    (falha, resultado) => falha ? reject(falha) : resolve(resultado || []),
                    (evento) => typeof onProgress === "function" && onProgress(evento)
                )
            })
        })

        // A resposta traz "Loaded image: nome:tag" em texto; devolvemos o que
        // veio mais os nomes extraídos, para quem quiser mostrar o resultado.
        const carregadas = saida
            .map((linha) => String(linha?.stream || "").match(/Loaded image(?: ID)?:\s*(\S+)/))
            .filter(Boolean)
            .map((casou) => casou[1])

        return { loaded: carregadas, output: saida }
    }

    const PruneImages = async ({ dangling = true, filters } = {}) => {
        /*
            `dangling: false` é o que apaga TODA imagem sem container — não só
            as órfãs sem tag. É a poda que mais libera espaço e a que mais
            surpreende, porque leva imagens perfeitamente utilizáveis que
            simplesmente não estão em uso agora.
        */
        const filtrosFinais = filters !== undefined
            ? filters
            : { dangling: dangling ? "true" : "false" }

        try {
            const resultado = await docker.pruneImages(BuildPruneOptions(filtrosFinais))
            return {
                ImagesDeleted: resultado?.ImagesDeleted || [],
                SpaceReclaimed: resultado?.SpaceReclaimed || 0
            }
        } catch (error) {
            console.error("Error pruning images:", error)
            throw error
        }
    }

    /*
        EXISTE VERSÃO MAIS NOVA? (CTMG-48)

        Compara o digest que o registry anuncia com o que está gravado no
        `RepoDigests` local. É funcionalidade paga no Portainer e a mais pedida
        pelo público das ferramentas gráficas.

        Imagem construída localmente não tem `RepoDigests`: nesse caso a
        resposta é `updateAvailable: null` com o motivo, e não `false`. Dizer
        "está atualizada" sobre algo que não dá para comparar seria mentir com
        um valor booleano.
    */
    const CheckImageUpdate = async ({ reference, auth }) => {
        const resposta = {
            reference,
            // O id local acompanha a resposta para que quem guarda o resultado
            // saiba de QUAL imagem ele fala. A referência não serve para isso:
            // ela muda de dono a cada `docker tag`.
            imageId: null,
            localDigest: null,
            remoteDigest: null,
            updateAvailable: null,
            reason: null,
            checkedAt: new Date().toISOString()
        }

        let local
        try {
            local = await docker.getImage(reference).inspect()
        } catch (error) {
            resposta.reason = "IMAGE_NOT_FOUND_LOCALLY"
            return resposta
        }

        resposta.imageId = local.Id

        const digestsLocais = local.RepoDigests || []
        if (digestsLocais.length === 0) {
            resposta.reason = "NO_REPO_DIGEST"
            return resposta
        }

        resposta.localDigest = String(digestsLocais[0]).split("@")[1] || null

        try {
            const distribuicao = await docker.getImage(reference).distribution(
                auth ? { authconfig: auth } : {}
            )
            resposta.remoteDigest = distribuicao?.Descriptor?.digest || null
        } catch (error) {
            /*
                "Não está no registry" e "não consegui falar com o registry"
                são coisas diferentes, e a interface reage a cada uma de um
                jeito: a primeira é normal para imagem construída aqui, a
                segunda é um problema de rede ou credencial que merece aviso.

                Só o código HTTP separa as duas.
            */
            const status = error?.statusCode ?? null
            resposta.reason = (status === 404 || status === 403)
                ? "NOT_IN_REGISTRY"
                : "REGISTRY_UNREACHABLE"
            resposta.error = error?.json?.message || error.message
            return resposta
        }

        if (!resposta.remoteDigest) {
            resposta.reason = "NO_REMOTE_DIGEST"
            return resposta
        }

        resposta.updateAvailable = resposta.localDigest !== resposta.remoteDigest
        return resposta
    }

    /*
        O ERRO DO BUILD VEM NO STREAM, NÃO NO EVENTO 'error' (VDRP-269).

        Quando um passo do `docker build` falha, o daemon não emite erro de
        stream: ele manda um evento `{"error": ..., "errorDetail": {...}}` dentro
        do `data` e ENCERRA normalmente. A versão anterior só observava 'end' e
        ia inspecionar uma imagem que nunca foi criada — o operador recebia
        "(HTTP code 404) no such image", que é o sintoma, e a causa real ficava
        enterrada no log do build.

        Custou um diagnóstico inteiro num log de 48 MB para descobrir que o
        motivo era outro (VDRP-268). Com o erro certo propagado, é imediato.

        `onData` continua recebendo TUDO, inclusive o evento de erro: quem
        registra o histórico de build precisa do log completo, não da versão
        filtrada.
    */
    const BuildImageFromDockerfileString = async ({
        buildargs,
        contextTarStream, imageTagName, onData
    }) => {
        return new Promise((resolve, reject) => {

            docker.buildImage(contextTarStream, { t: imageTagName, buildargs }, (err, stream) => {
                if (err) return reject(err)

                let buildError = null

                stream.on('data', (chunk) => {
                    if (typeof onData === "function") onData(chunk)

                    /*
                        Um chunk pode trazer mais de um JSON por linha, e linhas
                        parciais acontecem. Uma linha que não parseia é log
                        comum — nunca motivo para derrubar o build aqui.
                    */
                    for (const linha of chunk.toString("utf-8").split("\n")) {
                        const texto = linha.trim()
                        if (texto.length === 0) continue
                        try {
                            const evento = JSON.parse(texto)
                            if (evento.error || evento.errorDetail) {
                                buildError = evento.errorDetail?.message ?? evento.error
                            }
                        } catch {
                            // linha não-JSON: segue
                        }
                    }
                })

                stream.on('end', async () => {
                    if (buildError) {
                        const error = new Error(`Falha no build da imagem ${imageTagName}: ${buildError}`)
                        error.code = "IMAGE_BUILD_FAILED"
                        return reject(error)
                    }
                    try {
                        const image = docker.getImage(imageTagName)
                        const imageInfo = await image.inspect()
                        resolve(imageInfo)
                    } catch (inspectErr) {
                        reject(inspectErr)
                    }
                })
                stream.on('error', reject)
            })
        })
    }

    /*
        Build a partir do TEXTO do Dockerfile (CTMG-16).

        A API do Docker só aceita contexto em TAR, e montar TAR é conhecimento
        de formato de arquivo — que uma interface gráfica não deveria precisar
        ter. Quem tem esse conhecimento é este pacote, que já empacota arquivo
        para escrever em volume. Então quem chama manda o texto, e o TAR nasce
        aqui.

        Contexto de UM arquivo só: o suficiente para um Dockerfile que não
        depende de COPY/ADD de arquivos locais. Build com contexto de verdade
        continua sendo `BuildImageFromDockerfileString` com o stream pronto.
    */
    const BuildImageFromDockerfileContent = async ({
        imageTagName,
        dockerfileContent,
        buildargs,
        onData
    }) => {
        if (typeof dockerfileContent !== "string" || dockerfileContent.trim() === "") {
            const erro = new Error("O conteúdo do Dockerfile é obrigatório.")
            erro.code = "DOCKERFILE_CONTENT_REQUIRED"
            throw erro
        }

        const contexto = BuildTarWithSingleFile({
            name: "Dockerfile",
            content: dockerfileContent
        })

        const contextTarStream = new PassThrough()
        contextTarStream.end(contexto)

        return await BuildImageFromDockerfileString({
            imageTagName,
            buildargs,
            onData,
            contextTarStream
        })
    }

    return {
        ListAllImages,
        InspectImage,
        RemoveImage,
        ExportImage,
        BuildImageFromDockerfileString,
        BuildImageFromDockerfileContent,
        PullImage,
        PushImage,
        TagImage,
        GetImageHistory,
        SearchImages,
        RegistryLogin,
        LoadImage,
        PruneImages,
        CheckImageUpdate
    }
}

module.exports = CreateImageOperations
