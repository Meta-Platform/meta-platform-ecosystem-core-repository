const fs = require("fs")

/*
 * A camada que o painel consome para navegar e ler o histórico de log.
 *
 * O controller não conhece caminho nem formato: quem varre o disco e entende o
 * JSONL é o LogReaderService. Aqui ficam só a superfície HTTP/WS e a ingestão
 * do log que vem do navegador.
 */

const FOLLOW_INTERVAL_MS = 800

const LogsController = (params) => {

    const {
        logReaderService
    } = params

    /* GET /logs/tree */
    const GetLogTree = async () => logReaderService.GetLogTree()

    /* POST /logs/read — 2+ params chegam como objeto. */
    const ReadLog = async ({ path, fromOffset, maxLines, level, source, text, since, until } = {}) =>
        logReaderService.ReadLog({ path, fromOffset, maxLines, level, source, text, since, until })

    /*
     * WS /logs/stream — follow.
     *
     * `fs.watchFile` (stat periódico) e não `fs.watch` (inotify) pelo mesmo
     * motivo do log de instância: o arquivo pode ainda não existir quando o
     * painel abre a aba, e quem escreve é outro processo. O stat só roda
     * enquanto houver alguém assistindo.
     */
    const LogStream = (ws, filePath) => {

        if (!filePath || !logReaderService.IsPathAllowed(filePath)) {
            try { ws.send(JSON.stringify({ error : "caminho fora das áreas de log do ecossistema" })) } catch (e) {}
            try { ws.close() } catch (e) {}
            return
        }

        let offset = undefined
        let lendo  = false

        const _Enviar = async () => {

            if (lendo) return
            lendo = true

            try {
                const resultado = await logReaderService.ReadLog({ path : filePath, fromOffset : offset })
                offset = resultado.offset
                if (resultado.records.length > 0) ws.send(JSON.stringify(resultado))
            } catch (e) {
                /* Follow é best-effort: uma leitura que falha não fecha o canal. */
            } finally {
                lendo = false
            }
        }

        /* Primeira carga: o fim do arquivo, para a tela não abrir vazia. */
        logReaderService.ReadLog({ path : filePath })
            .then((resultado) => {
                offset = resultado.offset
                try { ws.send(JSON.stringify(resultado)) } catch (e) {}
            })
            .catch(() => {})

        const observador = () => { _Enviar() }

        try { fs.watchFile(filePath, { interval : FOLLOW_INTERVAL_MS }, observador) } catch (e) {}

        ws.on("close", () => {
            try { fs.unwatchFile(filePath, observador) } catch (e) {}
        })
    }

    /*
     * POST /logs/ingest — o log do NAVEGADOR.
     *
     * O React dos painéis não tem disco: manda o lote para cá e o backend
     * registra no logger deste processo, marcado com `origin: "browser"` para
     * ser filtrável e não se confundir com o log do ecossistema.
     */
    const IngestBrowserLog = async ({ records } = {}) => {

        if (!Array.isArray(records) || records.length === 0) return { ingested : 0 }

        const browserLog = Log.child({ origin : "browser" })

        let ingested = 0

        for (const record of records) {
            try {
                const level = typeof browserLog[record.level] === "function" ? record.level : "info"
                browserLog[level](record.source || "<browser>", record.message, record.data)
                ingested++
            } catch (e) {
                /* Um registro malformado do navegador não invalida o lote. */
            }
        }

        return { ingested }
    }

    return {
        controllerName : "LogsController",
        GetLogTree,
        ReadLog,
        LogStream,
        IngestBrowserLog
    }
}

module.exports = LogsController
