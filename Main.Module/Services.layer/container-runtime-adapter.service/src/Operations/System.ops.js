/*
    Operações de SISTEMA (CTMG-36) — hoje, o stream de eventos do runtime.

    É aqui que entram, no correr do épico, `GetRuntimeInfo`, `GetRuntimeVersion`,
    `PingRuntime`, `GetDiskUsage`, `PruneSystem` (CTMG-50, CTMG-51) e
    `StreamRuntimeEvents` (CTMG-52), que substitui o
    `RegisterDockerEventListener` legado abaixo.

    ---

    STREAM DE EVENTOS SOB DEMANDA (CTMG-32).

    Antes o stream era aberto na construção do adaptador. Como o gerenciador de
    conexões mantém um adaptador em cache POR CONEXÃO, isso significava um
    socket aberto por conexão cadastrada — mesmo sem ninguém escutando. Uma
    conexão remota fora do ar enchia o log com o mesmo erro, repetidamente,
    enquanto o app trabalhava noutra conexão.

    Agora o stream abre no primeiro assinante e fecha quando sai o último. A
    reconexão usa backoff porque runtime que caiu costuma demorar a voltar, e
    tentar a cada 100 ms só transforma a queda em ruído.
*/

const EventEmitter = require('node:events')

const BuildPruneOptions = require("../Helpers/BuildPruneOptions")

const DOCKER_EVENT = Symbol('dockerEvent')

const RECONEXAO_INICIAL_MS = 1000
const RECONEXAO_MAXIMA_MS = 30000

const CreateSystemOperations = ({ docker }) => {

    const eventEmitter = new EventEmitter()

    let eventStream = null
    let assinantes = 0
    let ultimoErro = null
    let esperaAtualMs = RECONEXAO_INICIAL_MS
    let temporizadorDeReconexao = null
    let desligado = false

    const _AgendarReconexao = () => {
        if (desligado || assinantes === 0 || temporizadorDeReconexao) return

        temporizadorDeReconexao = setTimeout(() => {
            temporizadorDeReconexao = null
            _AbrirEventStream()
        }, esperaAtualMs)

        // Não segura o processo vivo só por causa da tentativa de reconexão.
        if (typeof temporizadorDeReconexao.unref === "function") temporizadorDeReconexao.unref()

        esperaAtualMs = Math.min(esperaAtualMs * 2, RECONEXAO_MAXIMA_MS)
    }

    const _AbrirEventStream = () => {
        if (desligado || eventStream || assinantes === 0) return

        docker.getEvents({}, (err, stream) => {
            if (err) {
                ultimoErro = err
                _AgendarReconexao()
                return
            }

            if (assinantes === 0) {
                // O último assinante saiu enquanto o stream abria.
                try { stream.destroy() } catch (error) { /* já fechado */ }
                return
            }

            eventStream = stream
            ultimoErro = null
            esperaAtualMs = RECONEXAO_INICIAL_MS

            stream.on("data", (chunk) => {
                try {
                    eventEmitter.emit(DOCKER_EVENT, JSON.parse(chunk.toString()))
                } catch (parseErr) {
                    // Linha parcial ou keep-alive: não é motivo para poluir o log.
                }
            })

            stream.on("error", (erro) => {
                ultimoErro = erro
                eventStream = null
                _AgendarReconexao()
            })

            stream.on("end", () => {
                eventStream = null
                _AgendarReconexao()
            })
        })
    }

    const _FecharEventStream = () => {
        if (temporizadorDeReconexao) {
            clearTimeout(temporizadorDeReconexao)
            temporizadorDeReconexao = null
        }
        if (!eventStream) return
        try { eventStream.destroy() } catch (error) { /* já fechado */ }
        eventStream = null
    }

    const _RegistrarAssinante = () => {
        assinantes += 1
        if (assinantes === 1) _AbrirEventStream()
    }

    const _RemoverAssinante = () => {
        assinantes = Math.max(0, assinantes - 1)
        if (assinantes === 0) _FecharEventStream()
    }

    const GetEventStreamState = () => ({
        open: Boolean(eventStream),
        subscribers: assinantes,
        lastError: ultimoErro ? (ultimoErro.message || String(ultimoErro)) : null,
        retryInMs: temporizadorDeReconexao ? esperaAtualMs : null
    })

    /*
        Assina os eventos do runtime. A assinatura é o que ABRE o stream.

        Devolve `Unsubscribe`. Quem não chamar continua funcionando como antes,
        mas segura o stream aberto: o retorno existe para que dê para soltar.
    */
    const RegisterDockerEventListener = (f) => {
        const ouvinte = (eventData) => f(eventData)
        eventEmitter.on(DOCKER_EVENT, ouvinte)
        _RegistrarAssinante()

        let removido = false
        return () => {
            if (removido) return
            removido = true
            eventEmitter.removeListener(DOCKER_EVENT, ouvinte)
            _RemoverAssinante()
        }
    }

    /*
        EVENTOS DO RUNTIME, NORMALIZADOS (CTMG-52).

        O stream já existia e morria num EventEmitter interno: nenhuma rota o
        publicava, e por isso a interface inteira depende do botão "Atualizar".

        A diferença para `RegisterDockerEventListener` não é só o nome. O
        evento cru do Docker tem `Type`, `Action`, `Actor.ID`,
        `Actor.Attributes.name` e um `time`/`timeNano` — cinco lugares para
        procurar o que é sempre a mesma pergunta: o que mudou, em quem. Aqui
        isso vira uma forma só, e o cru continua disponível em `raw` para quem
        precisar de um campo que não previmos.

        Devolve `{ Close }`, como os outros streams: quem abriu precisa poder
        soltar.
    */
    const StreamRuntimeEvents = ({ filters, since, onData, onError, onEnd } = {}) => {
        let fechado = false

        const Normalizar = (evento) => ({
            type: evento.Type || evento.type || null,
            action: evento.Action || evento.action || null,
            id: evento.Actor?.ID || evento.id || null,
            name: evento.Actor?.Attributes?.name || null,
            attributes: evento.Actor?.Attributes || {},
            timeNano: evento.timeNano || (evento.time ? evento.time * 1e9 : null),
            raw: evento
        })

        /*
            O filtro é aplicado AQUI e não na chamada ao runtime, de propósito.

            O stream é único e compartilhado por todos os assinantes — é o que
            evita um socket por tela. Pedir um recorte ao daemon serviria o
            primeiro assinante e mutilaria os demais.
        */
        const tipos = filters?.type ? [].concat(filters.type) : null
        const acoes = filters?.action ? [].concat(filters.action) : null

        const Interessa = (evento) =>
            (!tipos || tipos.includes(evento.type))
            && (!acoes || acoes.includes(evento.action))

        const soltar = RegisterDockerEventListener((cru) => {
            if (fechado) return
            try {
                const evento = Normalizar(cru)
                if (Interessa(evento)) onData && onData(evento)
            } catch (erro) {
                onError && onError(erro)
            }
        })

        return {
            Close: () => {
                if (fechado) return
                fechado = true
                soltar()
                onEnd && onEnd()
            }
        }
    }

    /* ------------------------------------------------ informações e disco */

    const GetRuntimeInfo = async () => {
        try {
            return await docker.info()
        } catch (error) {
            console.error("Error reading runtime info:", error)
            throw error
        }
    }

    const GetRuntimeVersion = async () => {
        try {
            return await docker.version()
        } catch (error) {
            console.error("Error reading runtime version:", error)
            throw error
        }
    }

    /*
        Indisponibilidade é RESPOSTA, não exceção — mesma escolha do
        TestConnection: a tela precisa mostrar "offline" sem tratar erro linha
        a linha.
    */
    const PingRuntime = async () => {
        const inicio = Date.now()
        try {
            await docker.ping()
            return { ok: true, latencyMs: Date.now() - inicio }
        } catch (error) {
            return {
                ok: false,
                latencyMs: Date.now() - inicio,
                code: error.code || null,
                message: error.message
            }
        }
    }

    /*
        USO DE DISCO (CTMG-50).

        O `df` do daemon devolve tudo em maiúsculas e sem totais. A tela de
        manutenção precisa de duas respostas: quanto ocupa cada tipo e quanto
        dá para recuperar. A segunda não vem pronta — é somada aqui.

        Contêiner conta como recuperável quando está PARADO; imagem, quando
        nenhum container a usa; volume, quando nenhum container o monta.
    */
    const GetDiskUsage = async () => {
        try {
            const bruto = await docker.df()

            const imagens = bruto?.Images || []
            const containers = bruto?.Containers || []
            const volumes = bruto?.Volumes || []
            const cacheDeBuild = bruto?.BuildCache || []

            const Somar = (lista, Valor) => lista.reduce((total, item) => total + (Valor(item) || 0), 0)

            const recuperavel = {
                images: Somar(imagens.filter((i) => (i.Containers ?? 0) === 0), (i) => i.Size),
                containers: Somar(containers.filter((c) => c.State !== "running"), (c) => c.SizeRw),
                volumes: Somar(volumes.filter((v) => (v.UsageData?.RefCount ?? 0) === 0), (v) => v.UsageData?.Size),
                buildCache: Somar(cacheDeBuild.filter((c) => !c.InUse), (c) => c.Size)
            }

            recuperavel.total =
                recuperavel.images + recuperavel.containers + recuperavel.volumes + recuperavel.buildCache

            return {
                layersSize: bruto?.LayersSize || 0,
                images: imagens,
                containers,
                volumes,
                buildCache: cacheDeBuild,
                totals: {
                    images: Somar(imagens, (i) => i.Size),
                    containers: Somar(containers, (c) => c.SizeRw),
                    volumes: Somar(volumes, (v) => v.UsageData?.Size),
                    buildCache: Somar(cacheDeBuild, (c) => c.Size)
                },
                reclaimable: recuperavel
            }
        } catch (error) {
            console.error("Error reading disk usage:", error)
            throw error
        }
    }

    /*
        PODA POR TIPO (CTMG-51).

        A regra que define esta operação: UM TIPO QUE FALHA NÃO ABORTA OS
        OUTROS. Podar é uma sequência de operações independentes, e abortar no
        meio deixaria metade da limpeza feita sem dizer qual metade — o
        operador ficaria sem saber o que ainda ocupa espaço.

        Por isso cada tipo tem seu try, e o que falhou vai para `errors[]` com
        o nome do tipo.
    */
    const PruneSystem = async ({ types, danglingOnly = true, filters } = {}) => {
        const TIPOS_VALIDOS = ["containers", "images", "networks", "volumes", "buildCache"]
        const escolhidos = (types && types.length > 0 ? types : TIPOS_VALIDOS)
            .map(String)

        const desconhecidos = escolhidos.filter((tipo) => !TIPOS_VALIDOS.includes(tipo))
        if (desconhecidos.length > 0) {
            const erro = new Error(
                `Tipo de poda desconhecido: ${desconhecidos.join(", ")}. ` +
                `Use um de: ${TIPOS_VALIDOS.join(", ")}.`
            )
            erro.code = "INVALID_PRUNE_TYPE"
            erro.httpStatus = 400
            erro.statusCode = 400
            throw erro
        }

        const opcoes = BuildPruneOptions(filters)

        const PODAS = {
            containers: async () => {
                const r = await docker.pruneContainers(opcoes)
                return { deleted: r?.ContainersDeleted || [], spaceReclaimed: r?.SpaceReclaimed || 0 }
            },
            images: async () => {
                const r = await docker.pruneImages(
                    filters !== undefined
                        ? opcoes
                        : BuildPruneOptions({ dangling: danglingOnly ? "true" : "false" })
                )
                return { deleted: r?.ImagesDeleted || [], spaceReclaimed: r?.SpaceReclaimed || 0 }
            },
            networks: async () => {
                const r = await docker.pruneNetworks(opcoes)
                return { deleted: r?.NetworksDeleted || [], spaceReclaimed: 0 }
            },
            volumes: async () => {
                const r = await docker.pruneVolumes(opcoes)
                return { deleted: r?.VolumesDeleted || [], spaceReclaimed: r?.SpaceReclaimed || 0 }
            },
            buildCache: async () => {
                const r = await docker.pruneBuilder()
                return { deleted: r?.CachesDeleted || [], spaceReclaimed: r?.SpaceReclaimed || 0 }
            }
        }

        const perType = {}
        const errors = []
        let totalReclaimed = 0

        for (const tipo of escolhidos) {
            try {
                const resultado = await PODAS[tipo]()
                perType[tipo] = resultado
                totalReclaimed += resultado.spaceReclaimed
            } catch (error) {
                errors.push({
                    type: tipo,
                    code: error.code || null,
                    message: error?.json?.message || error.message
                })
            }
        }

        return { perType, totalReclaimed, errors }
    }

    return {
        RegisterDockerEventListener,
        GetEventStreamState,
        StreamRuntimeEvents,
        GetRuntimeInfo,
        GetRuntimeVersion,
        PingRuntime,
        GetDiskUsage,
        PruneSystem
    }
}

module.exports = CreateSystemOperations
