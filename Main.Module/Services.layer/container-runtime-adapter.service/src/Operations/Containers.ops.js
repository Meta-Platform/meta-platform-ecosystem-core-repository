/*
    Operações de CONTAINER (CTMG-36).

    Ciclo de vida, criação, inspeção, log e as três entregas contínuas — log ao
    vivo, métricas e terminal. Tudo o que responde à pergunta "o que este
    container está fazendo".

    Fábrica `(ctx) => ({ ...ops })`: o `docker` varia por conexão cadastrada, e
    os auxiliares compartilhados chegam pelo contexto em vez de serem importados
    aqui — quem compõe é o Container.manager.
*/

const { PassThrough } = require('node:stream')

const NormalizeContainerEnvironment =
    require("../Helpers/NormalizeContainerEnvironment")
// O contrato de criação com ~60 campos, e a volta dele (CTMG-54, 55, 56).
const { ValidateContainerSpec } = require("../Helpers/ContainerSpec")
const BuildContainerCreateOptions = require("../Helpers/BuildContainerCreateOptions")
const { NormalizeLegacySpec } = require("../Helpers/BuildContainerCreateOptions")
const DescribeContainerSpec = require("../Helpers/DescribeContainerSpec")
// Desenquadra o fluxo binário do runtime — que vem multiplexado ou cru, e nem
// sempre no formato que foi pedido (CTMG-21).
const CreateDockerStreamDecoder = require("../Helpers/DecodeDockerStream")
// A mesma tradução para quem acompanha e para quem tira uma foto (CTMG-40).
const NormalizeContainerStats = require("../Helpers/NormalizeContainerStats")
// Filtro em forma errada é filtro IGNORADO: na listagem mostra tudo, na poda
// apaga tudo (CTMG-40, CTMG-41).
const BuildPruneOptions = require("../Helpers/BuildPruneOptions")
const NormalizeDockerFilters = require("../Helpers/NormalizeDockerFilters")
const { ParseByteSize, CpusToNanoCpus } = require("../Helpers/ParseByteSize")

const BuildFilterOption = (filters) => {
    const normalizados = NormalizeDockerFilters(filters)
    return normalizados === undefined ? {} : { filters: normalizados }
}

/*
    Só inclui a chave quando há valor.

    Ausência e vazio não são a mesma coisa para a API do Docker: mandar
    `CpusetCpus: ""` num update REMOVE a restrição de núcleos, enquanto não
    mandar o campo a preserva. Espalhar `{...(x ? {K:x} : {})}` por vinte
    campos esconde essa regra; nomeá-la a torna visível.
*/
const ChaveSeDefinida = (chave, valor) =>
    valor === undefined || valor === null || valor === "" ? {} : { [chave]: valor }
// Traduz montagens, portas e grupos do host para o que a API espera, recusando
// o que não reconhece em vez de descartar em silêncio (CTMG-26, 28, 31).
const {
    NormalizeMounts,
    NormalizePorts,
    ResolveGroupAdd
} = require("../Helpers/NormalizeContainerCreateInput")

/*
    O ambiente de um exec pode chegar das duas formas que se usa por aí: o
    objeto `{ CHAVE: valor }` do resto deste pacote, ou a lista `["CHAVE=valor"]`
    da API do Docker. Aceitar as duas evita que quem já tem a lista pronta
    precise desmontá-la só para o adaptador remontar.
*/
const NormalizeExecEnvironment = (env) => {
    if (Array.isArray(env)) return env.map(String)
    return NormalizeContainerEnvironment(env)
}

const CreateContainerOperations = ({ docker, StreamToBuffer, SafeFileName }) => {

    /*
        LISTAGEM COM FILTRO (CTMG-41).

        Chamada sem argumento continua fazendo exatamente o que fazia — todos
        os containers, parados inclusive. É o que o service-orchestrator do
        VirtualDeskRepo espera, e ele vive em outro repositório.

        `filters` aceita o vocabulário do Docker: status, label, name,
        ancestor, network, health, exited, before, since.
    */
    const ListAllContainers = async ({ all = true, filters, limit } = {}) => {
        try {
            const containers = await docker.listContainers({
                all,
                ...BuildFilterOption(filters),
                ...(limit ? { limit: Number(limit) } : {})
            })
            return containers
        } catch (error) {
            console.error('Error listing containers with details:', error)
            throw error
        }

    }

    /*
        CRIAÇÃO DE CONTAINER (CTMG-55).

        A tradução dos ~60 campos vive em BuildContainerCreateOptions.js —
        função pura, verificável sem daemon. Aqui só se chama.

        A FORMA ANTIGA CONTINUA ENTRANDO. `CreateNewContainer` tem chamador em
        outro repositório (ServiceOrchestrator.manager.js, VirtualDeskRepo, que
        provisiona a nuvem corporativa): `NormalizeLegacySpec` reconhece
        `imageName`/`containerName`/`networkmode` e produz o mesmo JSON de
        sempre. Há teste de regressão com a chamada literal daquele arquivo.

        A validação acontece antes e devolve TODOS os campos errados de uma vez
        — um formulário de oito abas precisa marcar tudo junto, não um por
        tentativa.
    */
    const CreateNewContainer = async (spec) => {
        const { valid, errors } = ValidateContainerSpec(NormalizeLegacySpec(spec || {}))

        if (!valid) {
            /*
                COM UM ERRO SÓ, O ERRO É ELE.

                A validação existe para o formulário de oito abas, que precisa
                marcar todos os campos de uma vez. Mas quem chama a API com uma
                montagem malformada já recebia `INVALID_MOUNT` com o campo
                nomeado (CTMG-26), e trocar isso por um genérico
                `INVALID_CONTAINER_SPEC` quebraria um contrato que existe e tem
                teste — sem ganho nenhum, porque com um erro só não há o que
                agregar.

                `errors[]` vai junto nos dois casos: quem entende a forma nova
                a usa, quem espera a antiga continua encontrando o que espera.
            */
            const unico = errors.length === 1 ? errors[0] : null

            const erro = new Error(
                unico
                    ? unico.message
                    : `Configuração inválida em: ${errors.map((e) => e.field).join(", ")}.`
            )
            erro.code = unico ? unico.code : "INVALID_CONTAINER_SPEC"
            if (unico) erro.field = unico.field
            erro.errors = errors
            erro.httpStatus = 400
            erro.statusCode = 400
            throw erro
        }

        const container = await docker.createContainer(BuildContainerCreateOptions(spec))
        return await container.inspect()
    }

    /*
        LER O SPEC DE UM CONTAINER QUE EXISTE (CTMG-56).

        Base de editar, duplicar, copiar o `docker run` e promover container
        avulso a serviço de stack.
    */
    const GetContainerSpec = async (containerIdOrName) => {
        const inspecao = await docker.getContainer(containerIdOrName).inspect()
        return DescribeContainerSpec(inspecao, { imageEnv: await AmbienteDaImagem(inspecao) })
    }

    /*
        O ambiente que veio da IMAGEM, para poder ser subtraído do spec.

        Sem isto, o spec de um postgres sai com PG_VERSION, GOSU_VERSION e PATH
        como se fossem do usuário — e recriar congelaria a versão da imagem
        antiga. Custa um inspect a mais; falhar nele não pode impedir a leitura
        do spec, então o pior caso é voltar ao comportamento anterior.
    */
    const AmbienteDaImagem = async (inspecaoDoContainer) => {
        const referencia = inspecaoDoContainer?.Config?.Image || inspecaoDoContainer?.Image
        if (!referencia) return []

        try {
            const imagem = await docker.getImage(referencia).inspect()
            return imagem?.Config?.Env || []
        } catch (error) {
            return []
        }
    }

    /*
        RECRIAR PRESERVANDO CONFIGURAÇÃO E VOLUMES (CTMG-57).

        É a operação por trás de "editar container" e de "atualizar imagem com
        um clique". Como o Docker não altera a maior parte da configuração de
        um container existente, mudar qualquer coisa significa destruir e criar
        de novo — e é aí que se perde tudo, se for feito sem cuidado.

        A SEQUÊNCIA, e o porquê de cada passo:

          descrever   → o spec do que está lá, não o que alguém lembra
          parar       → escrita em curso não pode virar dado pela metade
          renomear    → o nome fica livre para o novo, e o antigo continua
                        existindo como rede de segurança
          criar/subir → o novo, com o patch aplicado
          remover     → só depois de o novo estar de pé

        E SE FALHAR NO MEIO: o antigo volta a ter o nome original e é religado.
        Sem isso, um erro de digitação numa porta deixaria o usuário sem
        serviço E sem o container de antes — o pior resultado possível de uma
        operação que ele pediu para "editar".
    */
    const RecreateContainer = async ({
        containerIdOrName,
        specPatch = {},
        keepName = true,
        removeOld = true
    }) => {
        const antigo = await docker.getContainer(containerIdOrName).inspect()
        const specOriginal = DescribeContainerSpec(antigo, {
            imageEnv: await AmbienteDaImagem(antigo)
        })
        const estavaRodando = Boolean(antigo.State?.Running)
        const nomeOriginal = String(antigo.Name || "").replace(/^\//, "")

        const specNovo = {
            ...specOriginal,
            ...specPatch,
            // Mesclagem rasa mudaria `resources` inteiro quando o patch traz um
            // campo só; estes três são sempre objetos e merecem mesclagem.
            ...(specPatch.resources ? { resources: { ...specOriginal.resources, ...specPatch.resources } } : {}),
            ...(specPatch.security ? { security: { ...specOriginal.security, ...specPatch.security } } : {}),
            ...(specPatch.network ? { network: { ...specOriginal.network, ...specPatch.network } } : {}),
            ...(keepName ? { name: specPatch.name || nomeOriginal } : {})
        }

        const nomeDeReserva = `${nomeOriginal}-old-${Date.now()}`
        let renomeado = false
        let novoId = null

        try {
            if (estavaRodando) await docker.getContainer(antigo.Id).stop()

            if (keepName) {
                await docker.getContainer(antigo.Id).rename({ name: nomeDeReserva })
                renomeado = true
            }

            const criado = await docker.createContainer(BuildContainerCreateOptions(specNovo))
            novoId = criado.id || criado.Id

            if (estavaRodando) await docker.getContainer(novoId).start()

            const info = await docker.getContainer(novoId).inspect()

            if (removeOld) {
                try {
                    await docker.getContainer(antigo.Id).remove({ force: true })
                } catch (erroDeLimpeza) {
                    // O novo já está de pé: falhar aqui não pode desfazer o que
                    // deu certo. O antigo aparece como órfão na manutenção.
                    console.error("Error removing old container after recreate:", erroDeLimpeza)
                }
            }

            return { oldContainerId: antigo.Id, newContainerInfo: info, started: estavaRodando }
        } catch (error) {
            await RestaurarAntigo({ antigo, nomeOriginal, renomeado, novoId, estavaRodando })

            const falha = new Error(
                `Não foi possível recriar ${nomeOriginal}: ${error.message}. ` +
                "O container anterior foi restaurado."
            )
            falha.code = "CONTAINER_RECREATE_FAILED"
            falha.containerId = antigo.Id
            falha.cause = error
            throw falha
        }
    }

    const RestaurarAntigo = async ({ antigo, nomeOriginal, renomeado, novoId, estavaRodando }) => {
        // Limpa o novo, se chegou a nascer: ele é que sobra.
        if (novoId) {
            try { await docker.getContainer(novoId).remove({ force: true }) } catch (e) { /* segue */ }
        }
        if (renomeado) {
            try { await docker.getContainer(antigo.Id).rename({ name: nomeOriginal }) } catch (e) { /* segue */ }
        }
        if (estavaRodando) {
            try { await docker.getContainer(antigo.Id).start() } catch (e) { /* segue */ }
        }
    }

    const RemoveContainer = async (containerIdOrName) => {
        try {
            const container = docker.getContainer(containerIdOrName)
            await container.remove({
                force: false,
                v: false
            })
            return { success: true, message: `Container ${containerIdOrName} removed successfully` }
        } catch (error) {
            console.error(`Error removing container ${containerIdOrName}:`, error)
            throw error
        }
    }

    const StartContainer = async (containerIdOrName) => {
        try {
            const container = docker.getContainer(containerIdOrName)
            await container.start()
            return { success: true, message: `Container ${containerIdOrName} started successfully` }
        } catch (error) {
            console.error(`Error starting container ${containerIdOrName}:`, error)
            throw error
        }
    }

    const StopContainer = async (containerIdOrName) => {
        try {
            const container = docker.getContainer(containerIdOrName)
            await container.stop()
            return { success: true, message: `Container ${containerIdOrName} stopped successfully` }
        } catch (error) {
            console.error(`Error stopping container ${containerIdOrName}:`, error)
            throw error
        }
    }

    const RestartContainer = async (containerIdOrName) => {
        try {
            const container = docker.getContainer(containerIdOrName)
            await container.restart()
            return { success: true, message: `Container ${containerIdOrName} restarted successfully` }
        } catch (error) {
            console.error(`Error restarting container ${containerIdOrName}:`, error)
            throw error
        }
    }

    const KillContainer = async (containerIdOrName) => {
        try {
            const container = docker.getContainer(containerIdOrName)
            await container.kill()
            return { success: true, message: `Container ${containerIdOrName} killed successfully` }
        } catch (error) {
            console.error(`Error killing container ${containerIdOrName}:`, error)
            throw error
        }
    }

    /*
        PAUSAR, RETOMAR E RENOMEAR (CTMG-37).

        `pause` congela os processos do container (via cgroup freezer) sem
        derrubá-los: a memória fica de pé e a retomada é instantânea. É outra
        coisa que `stop`, que manda SIGTERM e encerra — a diferença aparece
        quando se quer segurar um banco por um minuto sem perder conexão nem
        estado.
    */
    const PauseContainer = async (containerIdOrName) => {
        try {
            const container = docker.getContainer(containerIdOrName)
            await container.pause()
            return { success: true, message: `Container ${containerIdOrName} paused successfully` }
        } catch (error) {
            console.error(`Error pausing container ${containerIdOrName}:`, error)
            throw error
        }
    }

    const UnpauseContainer = async (containerIdOrName) => {
        try {
            const container = docker.getContainer(containerIdOrName)
            await container.unpause()
            return { success: true, message: `Container ${containerIdOrName} unpaused successfully` }
        } catch (error) {
            console.error(`Error unpausing container ${containerIdOrName}:`, error)
            throw error
        }
    }

    /*
        Renomear é a operação que evita o ciclo "destrói e recria" só porque o
        nome ficou errado — e é da qual `RecreateContainer` (CTMG-57) depende
        para guardar o container antigo enquanto o novo sobe.
    */
    const RenameContainer = async ({ containerIdOrName, name }) => {
        if (typeof name !== "string" || name.trim() === "") {
            const erro = new Error("Informe o novo nome do container.")
            erro.code = "INVALID_CONTAINER_NAME"
            erro.httpStatus = 400
            erro.statusCode = 400
            throw erro
        }

        try {
            const container = docker.getContainer(containerIdOrName)
            await container.rename({ name: name.trim() })
            return {
                success: true,
                message: `Container ${containerIdOrName} renamed to ${name.trim()}`
            }
        } catch (error) {
            console.error(`Error renaming container ${containerIdOrName}:`, error)
            throw error
        }
    }

    const InspectContainer = async (containerIdOrName) => {
        try {
            const container = docker.getContainer(containerIdOrName)
            const containerInfo = await container.inspect()
            return containerInfo
        } catch (error) {
            console.error(error)
            return null
        }
    }

    /*
        LOG AO VIVO (CTMG-23).

        `GetContainerLogHistory` devolve o que já aconteceu; isto acompanha o
        que está acontecendo. A diferença que importa para quem chama: aqui não
        há retorno, há um assinante — `onData` recebe cada pedaço à medida que
        o container escreve.

        Container sem TTY entrega o log MULTIPLEXADO (quadros de 8 bytes com
        stdout e stderr misturados no mesmo fluxo). `demuxStream` separa os
        dois; sem isso, o cabeçalho binário apareceria no meio do texto.

        Devolve um `Close`: stream de log segurado é conexão aberta com o
        runtime, e quem abriu precisa poder soltar.
    */
    const StreamContainerLogs = async ({
        containerIdOrName,
        tail = 200,
        onData,
        onError,
        onEnd
    }) => {
        const container = docker.getContainer(containerIdOrName)

        const stream = await container.logs({
            stdout: true,
            stderr: true,
            follow: true,
            tail,
            timestamps: false
        })

        const saida = new PassThrough()
        const erro = new PassThrough()

        saida.on("data", (pedaco) => onData && onData({ stream: "stdout", data: pedaco.toString("utf-8") }))
        erro.on("data", (pedaco) => onData && onData({ stream: "stderr", data: pedaco.toString("utf-8") }))

        try {
            container.modem.demuxStream(stream, saida, erro)
        } catch (error) {
            // TTY: o fluxo já vem limpo, sem quadros para separar.
            stream.on("data", (pedaco) => onData && onData({ stream: "stdout", data: pedaco.toString("utf-8") }))
        }

        stream.on("error", (error) => onError && onError(error))
        stream.on("end", () => onEnd && onEnd())

        return {
            Close: () => {
                try { stream.destroy() } catch (error) { /* já fechado */ }
            }
        }
    }

    /*
        MÉTRICAS AO VIVO (CTMG-22).

        O runtime entrega uma amostra por segundo, em JSON, com contadores
        ACUMULADOS de CPU. Percentual de CPU não vem pronto: é a variação entre
        duas amostras — por isso o cálculo acontece aqui, uma vez, e não em
        cada tela que quiser mostrar o número.
    */
    const StreamContainerStats = async ({ containerIdOrName, onData, onError, onEnd }) => {
        const container = docker.getContainer(containerIdOrName)
        const stream = await container.stats({ stream: true })

        let restante = ""

        stream.on("data", (pedaco) => {
            restante += pedaco.toString("utf-8")
            const linhas = restante.split("\n")
            restante = linhas.pop() || ""

            linhas
                .filter((linha) => linha.trim() !== "")
                .forEach((linha) => {
                    let amostra
                    try {
                        amostra = JSON.parse(linha)
                    } catch (error) {
                        return
                    }

                    onData && onData(NormalizeContainerStats(amostra))
                })
        })

        stream.on("error", (error) => onError && onError(error))
        stream.on("end", () => onEnd && onEnd())

        return {
            Close: () => {
                try { stream.destroy() } catch (error) { /* já fechado */ }
            }
        }
    }

    /*
        TERMINAL DENTRO DO CONTAINER (CTMG-21).

        Sessão de `exec` com TTY: entrada e saída ao vivo, como um shell.

        O shell é escolhido por TENTATIVA em ordem — nem toda imagem tem bash,
        e muitas (alpine, distroless-ish) só têm sh. Pedir bash direto faria o
        terminal falhar em metade dos containers, com um erro que não explica
        nada a quem só queria "abrir um terminal".

        Com TTY ligado não há multiplexação: o fluxo é bidirecional e limpo.
    */
    const OpenExecSession = async ({
        containerIdOrName,
        cmd,
        cols = 80,
        rows = 24,
        onData,
        onError,
        onEnd
    }) => {
        const container = docker.getContainer(containerIdOrName)

        const comando = Array.isArray(cmd) && cmd.length > 0
            ? cmd
            : ["/bin/sh", "-c", "command -v bash >/dev/null 2>&1 && exec bash || exec sh"]

        const exec = await container.exec({
            Cmd: comando,
            AttachStdin: true,
            AttachStdout: true,
            AttachStderr: true,
            Tty: true
        })

        const stream = await exec.start({ hijack: true, stdin: true })

        /*
            Mesmo pedindo TTY, o runtime pode devolver o fluxo enquadrado — foi
            o que aconteceu num container criado sem TTY. O decodificador
            observa o formato em vez de confiar no que foi pedido.
        */
        const decodificador = CreateDockerStreamDecoder({
            onData: ({ data }) => onData && onData(data)
        })

        stream.on("data", (pedaco) => decodificador.Push(pedaco))
        stream.on("error", (error) => onError && onError(error))
        stream.on("end", () => {
            decodificador.Flush()
            onEnd && onEnd()
        })

        try {
            await exec.resize({ h: rows, w: cols })
        } catch (error) {
            // Redimensionar é conforto, não requisito: se falhar, o terminal
            // continua utilizável no tamanho padrão.
        }

        return {
            Write: (dados) => {
                try { stream.write(dados) } catch (error) { onError && onError(error) }
            },
            Resize: async ({ cols: colunas, rows: linhas }) => {
                try { await exec.resize({ h: linhas, w: colunas }) } catch (error) { /* ver acima */ }
            },
            Inspect: () => exec.inspect(),
            Close: () => {
                try { stream.end() } catch (error) { /* já fechado */ }
                try { stream.destroy() } catch (error) { /* já fechado */ }
            }
        }
    }

    /*
        CRIAR E SUBIR NUMA OPERAÇÃO (CTMG-43) — o equivalente a `docker run`.

        A regra que importa aqui é o que acontece quando o start FALHA: o
        container NÃO é removido. Apagá-lo destruiria a única evidência do que
        deu errado — o log do processo que não subiu — e é exatamente por causa
        dessa evidência que se recorre ao terminal quando a interface não
        ajuda. O erro carrega o id e as últimas linhas, e o container fica lá
        para ser inspecionado.
    */
    const CreateAndStartContainer = async (spec) => {
        const containerInfo = await CreateNewContainer(spec)

        try {
            await docker.getContainer(containerInfo.Id).start()
        } catch (error) {
            const logs = await UltimasLinhasDoLog(containerInfo.Id)

            const falha = new Error(
                `O container ${containerInfo.Name || containerInfo.Id} foi criado mas não subiu: ${error.message}`
            )
            falha.code = "CONTAINER_START_FAILED"
            falha.containerId = containerInfo.Id
            falha.containerName = containerInfo.Name
            falha.logs = logs
            falha.cause = error
            throw falha
        }

        const depoisDeSubir = await docker.getContainer(containerInfo.Id).inspect()
        return { containerInfo: depoisDeSubir, started: true }
    }

    // Só para o diagnóstico da falha acima: o log de um container que não subiu
    // costuma ser curto, e falhar ao lê-lo não pode esconder o erro original.
    const UltimasLinhasDoLog = async (containerId) => {
        try {
            const bruto = await docker.getContainer(containerId).logs({
                stdout: true, stderr: true, follow: false, tail: 100
            })
            const texto = Buffer.isBuffer(bruto) ? bruto.toString("utf-8") : String(bruto)
            // Remove os cabeçalhos de quadro que sobrariam como lixo binário.
            return texto.replace(/[\x00-\x08\x0b-\x1f]/g, "")
        } catch (error) {
            return ""
        }
    }

    /*
        RECURSOS DE UM CONTAINER EM EXECUÇÃO (CTMG-38).

        Mudar memória, CPU ou política de reinício sem recriar — o que evita
        derrubar um banco só para dar mais RAM a ele.

        Os avisos do runtime são REPASSADOS, não engolidos: o Podman ignora
        alguns campos em silêncio (NanoCpus, certos securityOpt), e quem pediu
        precisa saber que o pedido não teve efeito. Ignorar em silêncio é o que
        faz alguém achar que limitou um container e descobrir o contrário
        quando a máquina trava.
    */
    const UpdateContainerResources = async ({ containerIdOrName, resources = {} }) => {
        const {
            memoryBytes,
            memoryReservationBytes,
            memorySwapBytes,
            cpus,
            nanoCpus,
            cpuShares,
            cpusetCpus,
            pidsLimit,
            blkioWeight,
            restart
        } = resources

        const atualizacao = {
            ...ChaveSeDefinida("Memory", ParseByteSize(memoryBytes, "resources.memoryBytes")),
            ...ChaveSeDefinida("MemoryReservation", ParseByteSize(memoryReservationBytes, "resources.memoryReservationBytes")),
            /*
                -1 é o valor com que a API diz "swap ilimitado". É o único
                negativo legítimo aqui, e por isso passa por fora do
                ParseByteSize, que recusa negativos de propósito.
            */
            ...ChaveSeDefinida("MemorySwap", Number(memorySwapBytes) === -1
                ? -1
                : ParseByteSize(memorySwapBytes, "resources.memorySwapBytes")),
            ...ChaveSeDefinida("NanoCpus", nanoCpus !== undefined
                ? Number(nanoCpus)
                : CpusToNanoCpus(cpus, "resources.cpus")),
            ...ChaveSeDefinida("CpuShares", cpuShares !== undefined ? Number(cpuShares) : undefined),
            ...ChaveSeDefinida("CpusetCpus", cpusetCpus),
            ...ChaveSeDefinida("PidsLimit", pidsLimit !== undefined ? Number(pidsLimit) : undefined),
            ...ChaveSeDefinida("BlkioWeight", blkioWeight !== undefined ? Number(blkioWeight) : undefined),
            ...(restart
                ? {
                    RestartPolicy: {
                        Name: String(restart.policy || "no"),
                        MaximumRetryCount: Number(restart.maximumRetryCount || 0)
                    }
                }
                : {})
        }

        if (Object.keys(atualizacao).length === 0) {
            const erro = new Error("Informe ao menos um recurso a atualizar.")
            erro.code = "NO_RESOURCES_TO_UPDATE"
            erro.httpStatus = 400
            erro.statusCode = 400
            throw erro
        }

        try {
            const container = docker.getContainer(containerIdOrName)
            const resultado = await container.update(atualizacao)
            return {
                success: true,
                applied: atualizacao,
                warnings: (resultado && resultado.Warnings) || []
            }
        } catch (error) {
            /*
                MEMÓRIA SOZINHA NÃO PASSA (visto contra o Docker 29.6.2).

                Baixar `Memory` num container cujo `MemorySwap` já está
                definido é recusado com 409 e um texto que fala de
                "memoryswap" — um campo que quem preencheu "256 MiB" no
                formulário nunca ouviu falar. O `docker update -m` sofre do
                mesmo, e a saída lá também é informar os dois.

                Não escolhemos um swap por conta própria: seria decidir uma
                política de memória no lugar de quem pediu. O que dá para
                fazer é transformar o texto do daemon em algo acionável, com o
                campo que falta nomeado.
            */
            const mencionaSwap = String(error && error.message || "").toLowerCase().includes("memoryswap")

            if (mencionaSwap && atualizacao.Memory !== undefined && atualizacao.MemorySwap === undefined) {
                const falha = new Error(
                    "Para alterar o limite de memória deste container é preciso informar também o " +
                    "limite de memória+swap (memorySwapBytes), porque ele já tem um definido. " +
                    "O valor precisa ser MAIOR OU IGUAL ao da memória: igual proíbe swap, " +
                    "maior permite a diferença em swap."
                )
                falha.code = "MEMORY_SWAP_REQUIRED"
                falha.field = "resources.memorySwapBytes"
                falha.httpStatus = 400
                falha.statusCode = 400
                falha.cause = error
                throw falha
            }

            console.error(`Error updating resources of container ${containerIdOrName}:`, error)
            throw error
        }
    }

    /*
        O QUE ESTÁ RODANDO LÁ DENTRO (CTMG-39).

        `top` responde à pergunta que o log não responde: o processo ainda está
        vivo? travou? virou zumbi? Sem isso, a única saída é abrir um terminal.
    */
    const ListContainerProcesses = async ({ containerIdOrName, psArgs } = {}) => {
        try {
            const container = docker.getContainer(containerIdOrName)
            const resultado = await container.top(psArgs ? { ps_args: psArgs } : {})
            return {
                titles: resultado?.Titles || [],
                processes: resultado?.Processes || []
            }
        } catch (error) {
            console.error(`Error listing processes of container ${containerIdOrName}:`, error)
            throw error
        }
    }

    /*
        O QUE MUDOU NO SISTEMA DE ARQUIVOS (CTMG-39).

        A API devolve `Kind` como número, e nenhum consumidor deveria precisar
        decorar que 1 é "adicionado". Traduzido aqui, uma vez.
    */
    const TIPOS_DE_MUDANCA = { 0: "modified", 1: "added", 2: "deleted" }

    const GetContainerFileSystemChanges = async (containerIdOrName) => {
        try {
            const container = docker.getContainer(containerIdOrName)
            const mudancas = await container.changes()
            return (mudancas || []).map((mudanca) => ({
                path: mudanca.Path,
                kind: TIPOS_DE_MUDANCA[mudanca.Kind] || "modified",
                kindCode: mudanca.Kind
            }))
        } catch (error) {
            console.error(`Error reading filesystem changes of container ${containerIdOrName}:`, error)
            throw error
        }
    }

    /*
        CONGELAR UM CONTAINER COMO IMAGEM (CTMG-39).

        `pause: true` por padrão, como o `docker commit` faz: sem pausar, o
        sistema de arquivos pode ser capturado no meio de uma escrita e a
        imagem nasce com um arquivo pela metade.
    */
    const CommitContainer = async ({
        containerIdOrName,
        repo,
        tag,
        comment,
        author,
        changes,
        pause = true
    }) => {
        try {
            const container = docker.getContainer(containerIdOrName)
            const resultado = await container.commit({
                ...ChaveSeDefinida("repo", repo),
                ...ChaveSeDefinida("tag", tag),
                ...ChaveSeDefinida("comment", comment),
                ...ChaveSeDefinida("author", author),
                ...ChaveSeDefinida("changes", changes),
                pause
            })

            const imageId = resultado?.Id || resultado?.ID
            const imageInfo = imageId ? await docker.getImage(imageId).inspect() : null

            return { imageId, imageInfo }
        } catch (error) {
            console.error(`Error committing container ${containerIdOrName}:`, error)
            throw error
        }
    }

    /*
        UMA FOTO EM VEZ DE UM FILME (CTMG-40).

        Até aqui só existia o stream. Para uma lista com cinquenta containers,
        abrir cinquenta streams — cada um uma conexão viva com o runtime — é
        impraticável, e no navegador esbarra no limite de sockets por host que
        já derrubou as métricas da versão web uma vez.

        Devolve EXATAMENTE a mesma forma do stream, pelo mesmo normalizador.

        Sobre o percentual de CPU: com `stream: false` o runtime coleta DUAS
        amostras antes de responder — por isso o percentual vem preenchido, e
        por isso a chamada demora cerca de 2 SEGUNDOS (medido contra o Docker
        29.6.2). Não é a mesma coisa que `one-shot`, que responde na hora e
        devolveria sempre 0%.

        Esses 2 segundos são por container: quem for pintar uma lista inteira
        precisa disparar as chamadas em paralelo, não em sequência.
    */
    const GetContainerStatsSnapshot = async (containerIdOrName) => {
        try {
            const container = docker.getContainer(containerIdOrName)
            const amostra = await container.stats({ stream: false })

            // Conforme a versão do dockerode, a amostra vem como objeto ou
            // como o texto cru da resposta.
            const dados = Buffer.isBuffer(amostra) || typeof amostra === "string"
                ? JSON.parse(String(amostra))
                : amostra

            return NormalizeContainerStats(dados)
        } catch (error) {
            console.error(`Error reading stats snapshot for container ${containerIdOrName}:`, error)
            throw error
        }
    }

    /*
        ESPERA O CONTAINER TERMINAR (CTMG-40).

        Bloqueia até a condição — é o que permite saber COM QUE CÓDIGO um
        container morreu, que é a primeira pergunta de quem vê um serviço
        parado sem explicação.

        `condition` aceita `not-running` (padrão), `next-exit` e `removed`.
    */
    const WaitContainer = async ({ containerIdOrName, condition = "not-running" }) => {
        try {
            const container = docker.getContainer(containerIdOrName)
            const resultado = await container.wait({ condition })
            return {
                StatusCode: resultado?.StatusCode ?? null,
                Error: resultado?.Error ?? null
            }
        } catch (error) {
            console.error(`Error waiting for container ${containerIdOrName}:`, error)
            throw error
        }
    }

    /*
        PODA DE CONTAINERS PARADOS (CTMG-40).

        Apaga TODOS os containers parados da conexão — inclusive os que não
        foram criados por este app. Quem chama pela interface passa antes pela
        prévia de CTMG-129, que lista nome por nome: um botão de limpeza que
        não diz o que vai apagar é como se perde container parado que alguém
        guardou de propósito para investigar.
    */
    const PruneContainers = async ({ filters } = {}) => {
        try {
            const resultado = await docker.pruneContainers(BuildPruneOptions(filters))
            return {
                ContainersDeleted: resultado?.ContainersDeleted || [],
                SpaceReclaimed: resultado?.SpaceReclaimed || 0
            }
        } catch (error) {
            console.error("Error pruning containers:", error)
            throw error
        }
    }

    /*
        EXEC DE UMA TACADA (CTMG-42).

        `OpenExecSession` abre um terminal: TTY, entrada do usuário, sem fim
        previsto. Isto é o oposto — rode um comando, me devolva o que ele
        escreveu e com que código saiu. Metade das funcionalidades que faltam
        precisa disto e não do terminal: navegador de arquivos do container,
        healthcheck manual, clone de volume, diagnóstico.

        SEM TTY de propósito: é o que faz o runtime entregar stdout e stderr
        ENQUADRADOS e portanto separáveis. Com TTY os dois vêm misturados no
        mesmo fluxo, e "o que foi para o erro?" deixa de ter resposta — que é
        justamente a pergunta de quem chama isto.
    */
    const RunExec = async ({
        containerIdOrName,
        cmd,
        user,
        workingDir,
        env,
        timeoutMs = 30000
    }) => {
        if (!Array.isArray(cmd) || cmd.length === 0) {
            const erro = new Error(
                "Informe o comando como lista de argumentos, ex.: [\"sh\", \"-c\", \"ls -la\"]."
            )
            erro.code = "INVALID_EXEC_COMMAND"
            erro.httpStatus = 400
            erro.statusCode = 400
            throw erro
        }

        const container = docker.getContainer(containerIdOrName)

        const exec = await container.exec({
            Cmd: cmd.map(String),
            AttachStdin: false,
            AttachStdout: true,
            AttachStderr: true,
            Tty: false,
            ...(user ? { User: String(user) } : {}),
            ...(workingDir ? { WorkingDir: String(workingDir) } : {}),
            ...(env ? { Env: NormalizeExecEnvironment(env) } : {})
        })

        const stream = await exec.start({ hijack: true, stdin: false })

        let stdout = ""
        let stderr = ""

        // O mesmo decodificador do terminal: ele OBSERVA o formato em vez de
        // confiar no `Tty` que foi pedido — ver DecodeDockerStream.js.
        const decodificador = CreateDockerStreamDecoder({
            onData: ({ stream: fluxo, data }) => {
                if (fluxo === "stderr") stderr += data
                else stdout += data
            }
        })

        const timedOut = await new Promise((resolve, reject) => {
            let encerrado = false

            const Encerrar = (expirou) => {
                if (encerrado) return
                encerrado = true
                clearTimeout(temporizador)
                resolve(expirou)
            }

            /*
                Este temporizador NÃO leva `unref()`, ao contrário do de
                reconexão em System.ops.

                A diferença é quem espera: lá é uma tentativa de fundo, e um
                processo ocioso deve poder terminar apesar dela. Aqui alguém
                está `await`-ando esta promessa, e o temporizador é a única
                coisa capaz de resolvê-la quando o comando não termina.
                Soltá-lo do laço de eventos faria a promessa nunca resolver num
                processo sem outro trabalho — que é exatamente o caso de um
                script ou de um teste.
            */
            const temporizador = setTimeout(() => {
                try { stream.destroy() } catch (error) { /* já fechado */ }
                Encerrar(true)
            }, timeoutMs)

            stream.on("data", (pedaco) => decodificador.Push(pedaco))
            stream.on("end", () => Encerrar(false))
            stream.on("close", () => Encerrar(false))
            stream.on("error", (erro) => {
                if (encerrado) return
                encerrado = true
                clearTimeout(temporizador)
                reject(erro)
            })
        })

        decodificador.Flush()

        /*
            O código de saída vem do inspect do exec, não do stream.

            Quando expirou, ele costuma vir `null`: o processo AINDA ESTÁ
            RODANDO dentro do container. Soltar o fluxo não mata nada — a API
            do Docker não oferece como matar um exec. Por isso `timedOut` é um
            campo de resposta e não uma exceção: quem chamou precisa saber que
            deixou algo para trás.
        */
        let exitCode = null
        try {
            const detalhes = await exec.inspect()
            exitCode = detalhes && detalhes.ExitCode !== undefined ? detalhes.ExitCode : null
        } catch (error) {
            // Exec já colhido pelo runtime: sem código, e não é motivo para
            // descartar a saída que chegou.
        }

        return { exitCode, stdout, stderr, timedOut }
    }

    const GetContainerLogHistory = async (containerIdOrName) => {
        try {
            const container = docker.getContainer(containerIdOrName)
            const logBuffer = await container.logs({
                stdout: true,
                stderr: true,
                follow: false,
                tail: "all"
            })
            // If docker returned a Buffer it may contain multiplexed headers when
            // the container was not started with a TTY. Those headers are 8-byte
            // frames: [streamType(1)][0][0][0][length(4-be)]...payload...
            // Parse and strip them so the output keeps ANSI sequences (colors)
            // and line breaks intact for TTY display.
            if (Buffer.isBuffer(logBuffer)) {
                const buf = logBuffer
                // quick detection: first byte 0x01 or 0x02 and next three bytes 0x00
                if (buf.length >= 8 && (buf[0] === 1 || buf[0] === 2) && buf[1] === 0 && buf[2] === 0 && buf[3] === 0) {
                    let idx = 0
                    const outChunks = []
                    while (idx + 8 <= buf.length) {
                        const streamType = buf[idx]
                        const payloadLen = buf.readUInt32BE(idx + 4)
                        const start = idx + 8
                        const end = start + payloadLen
                        if (end > buf.length) {
                            // malformed/truncated frame: push remainder and break
                            outChunks.push(buf.slice(start))
                            break
                        }
                        const payload = buf.slice(start, end)
                        outChunks.push(payload)
                        idx = end
                    }
                    try {
                        // return as base64 so transport (JSON) doesn't escape ANSI bytes
                        return { isBase64: true, data: Buffer.concat(outChunks).toString('base64') }
                    } catch (e) {
                        return { isBase64: true, data: Buffer.concat(outChunks).toString('base64') }
                    }
                }
                // not multiplexed - return UTF-8 string
                try {
                    return { isBase64: true, data: buf.toString('base64') }
                } catch (e) {
                    return { isBase64: true, data: buf.toString('base64') }
                }
            }

            // if not a Buffer, stringify and return as plain text
            if (typeof logBuffer === 'string') {
                return { isBase64: false, data: logBuffer }
            }

            return { isBase64: false, data: String(logBuffer) }
        } catch (error) {
            console.error(`Error getting logs for container ${containerIdOrName}:`, error)
            throw error
        }
    }

    // Exporta o filesystem de um container (equivalente a `docker export`)
    // — retorna um tar em base64.
    const ExportContainer = async (containerIdOrName) => {
        try {
            const container = docker.getContainer(containerIdOrName)
            const stream = await container.export()
            const buffer = await StreamToBuffer(stream)
            return {
                isBase64 : true,
                fileName : `${SafeFileName(containerIdOrName, "container")}.tar`,
                mimeType : "application/x-tar",
                data     : buffer.toString("base64")
            }
        } catch (error) {
            console.error(`Error exporting container ${containerIdOrName}:`, error)
            throw error
        }
    }

    return {
        ListAllContainers,
        CreateNewContainer,
        StartContainer,
        StopContainer,
        RestartContainer,
        KillContainer,
        PauseContainer,
        UnpauseContainer,
        RenameContainer,
        RemoveContainer,
        InspectContainer,
        GetContainerLogHistory,
        ExportContainer,
        StreamContainerLogs,
        StreamContainerStats,
        OpenExecSession,
        RunExec,
        GetContainerStatsSnapshot,
        WaitContainer,
        PruneContainers,
        CreateAndStartContainer,
        UpdateContainerResources,
        ListContainerProcesses,
        GetContainerFileSystemChanges,
        CommitContainer,
        GetContainerSpec,
        RecreateContainer
    }
}

module.exports = CreateContainerOperations
