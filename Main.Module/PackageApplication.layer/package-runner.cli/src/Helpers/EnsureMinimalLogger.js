/*
 * Logger de último recurso, LOCAL — garante que `globalThis.Log` exista mesmo
 * quando a `logger.lib` do EssentialRepo não pode ser carregada (VDRP-275).
 *
 * Por que é local e não vem da lib: este módulo existe justamente para o caso em
 * que a lib NÃO está disponível — um EssentialRepo instalado anterior a ela, um
 * `installationPath` que não resolve, uma instalação a meio caminho. Buscar a
 * garantia na lib que falhou seria circular.
 *
 * O que ele evita: o ecossistema chama `Log.<nível>` direto, sem guarda, porque
 * esse é o contrato do logger global. Sem `globalThis.Log`, a primeira chamada
 * lança `ReferenceError: Log is not defined` — e quando isso cai dentro de um
 * `catch`, a exceção original é substituída pelo ReferenceError e a causa real
 * desaparece. Em 29/07/2026 esse padrão travou o provisionamento da plataforma
 * VirtualDesk por quase 24 horas (VDRP-252, VDRP-268).
 *
 * Deliberadamente pobre: escreve no console e nada mais. Fica marcado como
 * `minimal` para o `InstallGlobalLogger` canônico substituí-lo quando puder.
 */

const NIVEIS = ["trace", "debug", "info", "message", "warn", "error", "fatal"]

const GLOBAL_KEY  = "Log"
const GLOBAL_MARK = Symbol.for("meta-platform.logger.globalLogger")

const Escrever = (nivel, origem, argumentos) => {

    const partes = argumentos.map((a) =>
        (a && a.stack) ? a.stack : (typeof a === "object" ? JSON.stringify(a) : String(a)))

    try {
        /* error/fatal no stderr: sobrevive a stdout redirecionado e é o que o
           build do Docker mostra quando um passo falha. */
        const stream = (nivel === "error" || nivel === "fatal")
            ? process.stderr
            : process.stdout

        stream.write(`[${origem}] ${partes.join(" ")}\n`)
    } catch (error) {
        /* sem stream não há para onde ir */
    }
}

const EnsureMinimalLogger = () => {

    if (globalThis[GLOBAL_KEY]) {
        return globalThis[GLOBAL_KEY]
    }

    const logger = {}

    NIVEIS.forEach((nivel) => {
        logger[nivel] = (origem, ...argumentos) => Escrever(nivel, origem, argumentos)
    })

    logger.minimal         = true
    logger.FlushSync       = () => {}
    logger.OpenFileChannel = () => {
        const canal = {}
        NIVEIS.forEach((nivel) => { canal[nivel] = () => {} })
        canal.Close = async () => {}
        return canal
    }

    globalThis[GLOBAL_KEY] = logger

    /* A marca precisa trazer `minimal` e os dois desmontadores que o
       UninstallGlobalLogger da lib canônica chama ao substituir. */
    try {
        Object.defineProperty(globalThis, GLOBAL_MARK, {
            value        : {
                minimal             : true,
                UninstallBridge     : () => {},
                UnregisterExitFlush : () => {}
            },
            configurable : true,
            enumerable   : false,
            writable     : false
        })
    } catch (error) {
        /* marca já definida por outro caminho — o logger acima já está válido */
    }

    return logger
}

module.exports = EnsureMinimalLogger
