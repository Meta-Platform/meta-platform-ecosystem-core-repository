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
            const buffer = await StreamToBuffer(stream)
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
        BuildImageFromDockerfileContent
    }
}

module.exports = CreateImageOperations
