import GetAPI from "./GetAPI"

/*
 * O `Log` do NAVEGADOR.
 *
 * O React dos painéis não tem disco: acumula os registros num lote e despacha
 * periodicamente para `POST /logs/ingest`, onde o backend os grava com
 * `origin: "browser"` — filtrável, e sem se confundir com o log do ecossistema.
 *
 * Mesmo contrato de sete níveis do `globalThis.Log` do backend, para quem
 * escreve não precisar lembrar onde está.
 *
 * Três cuidados, todos pela mesma razão — a tela não pode parar por causa do log:
 *
 *   1. UMA requisição por janela de tempo, nunca uma por evento;
 *   2. teto de eventos por janela: um loop de render com log dentro gera
 *      milhares por segundo e afogaria o arquivo;
 *   3. falha de rede descarta o lote em silêncio.
 */

const NIVEIS = ["trace", "debug", "info", "message", "warn", "error", "fatal"]

const INTERVALO_DE_DESPACHO_MS = 2000
const MAXIMO_POR_LOTE          = 50
const MAXIMO_NA_FILA           = 500

let fila:any[] = []
let descartados = 0
let temporizador:any = null
let serverManagerInformation:any = null

const _Despachar = async () => {

    if(fila.length === 0) return

    const lote = fila.slice(0, MAXIMO_POR_LOTE)
    fila = fila.slice(MAXIMO_POR_LOTE)

    /* O que foi descartado por flood vira UM registro, não mil. */
    if(descartados > 0){
        lote.push({
            level   : "warn",
            source  : "<browser>",
            message : `${descartados} registro(s) do navegador descartado(s) por excesso`
        })
        descartados = 0
    }

    try {
        await GetAPI({ apiName : "Logs", serverManagerInformation }).IngestBrowserLog({ records : lote })
    } catch(e) {
        /* Sem rede, o lote se perde. Log é observabilidade, não caminho crítico. */
    }
}

const _Enfileirar = (level:string, source:string, message:any, data?:any) => {

    if(fila.length >= MAXIMO_NA_FILA){
        descartados++
        return
    }

    fila.push({
        level,
        source  : source || "<browser>",
        message : typeof message === "string" ? message : JSON.stringify(message),
        data
    })
}

const BrowserLog:any = NIVEIS.reduce((logger:any, level:string) => {
    logger[level] = (source:string, message:any, data?:any) => _Enfileirar(level, source, message, data)
    return logger
}, {})

/*
 * Liga o envio. Chamado uma vez, quando o painel sabe com qual servidor falar.
 * Idempotente: chamar de novo só atualiza o servidor.
 */
BrowserLog.Install = (serverManager:any) => {

    serverManagerInformation = serverManager

    if(temporizador) return BrowserLog

    temporizador = setInterval(_Despachar, INTERVALO_DE_DESPACHO_MS)

    /* Erro não tratado da tela também é log — e é o que mais interessa. */
    window.addEventListener("error", (evento:any) => {
        _Enfileirar("error", "window.onerror", evento?.message || "erro não tratado", {
            file : evento?.filename,
            line : evento?.lineno
        })
    })

    window.addEventListener("unhandledrejection", (evento:any) => {
        _Enfileirar("error", "unhandledrejection", String(evento?.reason?.message || evento?.reason || "promise rejeitada"))
    })

    /* Ao fechar a aba, tenta mandar o que sobrou. */
    window.addEventListener("beforeunload", () => { _Despachar() })

    return BrowserLog
}

BrowserLog.Flush = _Despachar

export default BrowserLog
