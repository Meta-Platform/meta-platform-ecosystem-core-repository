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

    return {
        RegisterDockerEventListener,
        GetEventStreamState
    }
}

module.exports = CreateSystemOperations
