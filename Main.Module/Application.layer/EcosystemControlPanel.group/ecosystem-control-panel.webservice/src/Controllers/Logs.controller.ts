const fs = require("fs")

/*
 * A camada que o painel consome para navegar e ler o histórico de log.
 *
 * O controller não conhece caminho nem formato: quem varre o disco e entende o
 * JSONL é o LogReaderService. Aqui ficam só a superfície HTTP/WS e a ingestão
 * do log que vem do navegador.
 */

const FOLLOW_INTERVAL_MS = 800

/* Teto de registros por requisição de ingestão — a trava do lado do servidor. */
const MAX_RECORDS_PER_INGEST = 200

const LogsController = (params: any) => {

    const {
        logReaderService
    } = params

    /* GET /logs/tree */
    const GetLogTree = async () => logReaderService.GetLogTree()

    /* POST /logs/read — 2+ params chegam como objeto. */
    const ReadLog = async ({ path, fromOffset, maxLines, level, source, text, since, until }: any = {}) =>
        logReaderService.ReadLog({ path, fromOffset, maxLines, level, source, text, since, until })

    /*
     * WS /logs/stream — follow.
     *
     * `fs.watchFile` (stat periódico) e não `fs.watch` (inotify) pelo mesmo
     * motivo do log de instância: o arquivo pode ainda não existir quando o
     * painel abre a aba, e quem escreve é outro processo. O stat só roda
     * enquanto houver alguém assistindo.
     */
    const LogStream = (ws: any, filePath: any) => {

        if (!filePath || !logReaderService.IsPathAllowed(filePath)) {
            try { ws.send(JSON.stringify({ error : "caminho fora das áreas de log do ecossistema" })) } catch(e: any) {}
            try { ws.close() } catch(e: any) {}
            return
        }

        let offset: any = undefined
        let lendo  = false

        const _Enviar = async () => {

            if (lendo) return
            lendo = true

            try {
                const resultado = await logReaderService.ReadLog({ path : filePath, fromOffset : offset })
                offset = resultado.offset
                if (resultado.records.length > 0) ws.send(JSON.stringify(resultado))
            } catch(e: any) {
                /* Follow é best-effort: uma leitura que falha não fecha o canal. */
            } finally {
                lendo = false
            }
        }

        /* Primeira carga: o fim do arquivo, para a tela não abrir vazia. */
        logReaderService.ReadLog({ path : filePath })
            .then((resultado: any) => {
                offset = resultado.offset
                try { ws.send(JSON.stringify(resultado)) } catch(e: any) {}
            })
            .catch(() => {})

        const observador = () => { _Enviar() }

        try { fs.watchFile(filePath, { interval : FOLLOW_INTERVAL_MS }, observador) } catch(e: any) {}

        ws.on("close", () => {
            try { fs.unwatchFile(filePath, observador) } catch(e: any) {}
        })
    }

    /*
     * POST /logs/ingest — o log do NAVEGADOR.
     *
     * O React dos painéis não tem disco: manda o lote para cá e o backend
     * registra no logger deste processo, marcado com `origin: "browser"` para
     * ser filtrável e não se confundir com o log do ecossistema.
     */
    const IngestBrowserLog = async ({ records }: any = {}) => {

        if (!Array.isArray(records) || records.length === 0) return { ingested : 0 }

        const browserLog = Log.child({ origin : "browser" })

        /*
         * Teto do SERVIDOR. O cliente já limita a fila, mas o backend não pode
         * confiar nisso: qualquer aba aberta pode mandar um lote enorme, e é o
         * arquivo de log daqui que afogaria. O excedente vira UMA linha.
         */
        const aceitos = records.slice(0, MAX_RECORDS_PER_INGEST)
        const excedente = records.length - aceitos.length

        let ingested = 0

        for (const record of aceitos) {
            try {
                const level = typeof (browserLog as any)[record.level] === "function" ? record.level : "info"
                ;(browserLog as any)[level](record.source || "<browser>", record.message, record.data)
                ingested++
            } catch(e: any) {
                /* Um registro malformado do navegador não invalida o lote. */
            }
        }

        if (excedente > 0) {
            try {
                browserLog.warn("<browser>", `${excedente} registro(s) do navegador recusado(s): lote acima do teto de ${MAX_RECORDS_PER_INGEST}`)
            } catch(e: any) {}
        }

        return { ingested, rejected : excedente }
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
