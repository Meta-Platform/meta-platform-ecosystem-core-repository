// Processo filho que compila a interface web e MORRE.
//
// A razão de existir: soltar as referências de um build não devolve memória ao
// sistema operacional. O V8 mantém o heap que já reservou — depois de um build,
// o processo continua ocupando o pico que atingiu, mesmo com tudo coletado.
// Quem devolve página ao SO é o processo ao terminar. Por isso o build de uma
// janela desktop, que fica aberta por horas, acontece aqui e não no processo
// principal do Electron.
//
// Contrato de fronteira: NENHUM objeto do webpack atravessa o IPC. O que volta
// é um resumo com contadores e mensagens de texto — mandar o `stats` faria o
// pai reconstruir, no `JSON.parse`, boa parte do que se queria deixar para trás.
//
// Este arquivo é autônomo de propósito: só depende dos seus vizinhos de pacote
// e do SmartRequire, cujo caminho chega no job. Ele nunca instancia o
// WebInterfaceBuilder — é o que impede um worker de abrir outro worker.

const fs   = require("fs") as typeof import("fs")
const path = require("path") as typeof import("path")

// Este processo é lançado POR CAMINHO, e não herda a resolução de TypeScript —
// ela vive no EssentialRepo, e o worker é autônomo de propósito (ver o topo).
// Então os vizinhos que ele carrega são procurados como o próprio worker é:
// pelo arquivo que existe, seja .js ou .ts. Fixar a extensão aqui, em qualquer
// um dos dois dialetos, é o que faria o worker parar de subir no dia da troca.
const _RequireSibling = (name: string): any => {
    const base = path.join(__dirname, name)
    return require([`${base}.js`, `${base}.ts`].find((candidate) => fs.existsSync(candidate)) ?? base)
}

const BuildProfiles       = _RequireSibling("BuildProfiles")
const ResolveBuildEngine  = _RequireSibling("ResolveBuildEngine")

const _Send = (message: any) => {
    if(process.send) process.send(message)
    else console.log(JSON.stringify(message))
}

const _Message = (entry: any): string =>
    typeof entry === "string" ? entry : (entry && (entry.message || String(entry))) || ""


// A resolução de TypeScript também é instalada por conta própria, e ANTES de
// qualquer require por caminho: o hook vive no processo, e este é um processo
// novo — nada do pai atravessa o spawn. Sem isto, carregar a logger.lib (que é
// TypeScript) falha no primeiro vizinho que ela pede sem extensão, e o catch
// logo abaixo engole a falha: o build seguia sem logger nenhum, em silêncio.
const _InstallTypeScriptResolution = (job: any) => {
    const installPath = job.installTypeScriptResolutionPath || process.env.META_INSTALL_TYPESCRIPT_RESOLUTION_PATH
    if(!installPath) return
    try { require(installPath)() }
    catch(e) { /* essential anterior à module-resolution.lib: segue como antes */ }
}

// O logger global é instalado por conta própria: este processo não herda o
// `globalThis.Log` de ninguém, e os módulos que ele carrega usam `Log` direto.
const _InstallLogger = (job: any) => {
    if(globalThis.Log) return
    try {
        const installPath = job.installGlobalLoggerPath || process.env.META_INSTALL_GLOBAL_LOGGER_PATH
        if(installPath){
            require(installPath)({ origin: "webgui-build-worker", disableFileSink: !job.logsDirPath })
            return
        }
    } catch(e) { /* segue sem logger de arquivo */ }

    const _noop = () => {}
    globalThis.Log = { info: _noop, warn: _noop, error: _noop, message: _noop, child: () => globalThis.Log, source: () => globalThis.Log } as any
}

// O pico de RSS do FILHO é a prova de que o build saiu daqui: é o número que o
// pai registra no log ("processo isolado, pico de N MB"). Medido no envio, e não
// dentro do resumo, porque o resumo agora é do motor — e o motor não sabe (nem
// precisa saber) que está rodando num processo separado.
const _WithPeakRss = (summary: any) => ({
    ...summary,
    peakRssBytes: process.memoryUsage ? process.memoryUsage().rss : undefined
})

const RunJob = async (job: any): Promise<{ exitAfterSend: boolean }> => {
    // Ordem obrigatória: a resolução primeiro, porque o logger é TypeScript.
    _InstallTypeScriptResolution(job)
    _InstallLogger(job)

    const profile = BuildProfiles.ResolveBuildProfile({
        profileName: job.buildProfile,
        isWatch:     job.isWatch,
        overrides:   job.buildOverrides
    })

    // O MOTOR vem do job: o pai já resolveu qual é, e o filho não pode escolher
    // sozinho — divergir aqui faria o build isolado produzir um artefato
    // diferente do que o build em processo produziria, sem nada acusar.
    const engine = ResolveBuildEngine({
        engineName:   job.buildEngine,
        SmartRequire: require(job.smartRequirePath)
    })

    let lastReported = -1
    const onProgress = (percentage: number) => {
        const rounded = Math.round(percentage * 100)
        // Só quando o inteiro muda: o ProgressPlugin dispara centenas de vezes
        // por segundo e cada mensagem é uma serialização no canal.
        if(rounded !== lastReported){
            lastReported = rounded
            _Send({ type: "progress", percentage: rounded })
        }
    }

    const session = engine.CreateSession({
        params:  { ...job.params, onProgress: job.reportProgress ? onProgress : undefined },
        profile
    })

    if(!profile.watch){
        // Build de uma vez: compila, responde e o processo acaba. O `Close()`
        // aqui é por higiene — o que realmente libera tudo é o exit logo abaixo.
        const summary = await session.RunOnce()
        await session.Close()
        _Send({ type: "done", summary: _WithPeakRss(summary) })
        return { exitAfterSend: true }
    }

    // Watch: o processo fica vivo, dono do watcher, até o pai pedir para fechar.
    // Toda a memória do watch mora aqui — nenhuma parte dela toca o processo pai.
    let hasSentFirst = false
    await session.StartWatch({
        onCycle: ({ summary, error }: any) => {
            if(error) return _Send({ type: "error", message: _Message(error), stack: error && error.stack })
            _Send({ type: hasSentFirst ? "rebuilt" : "done", summary: _WithPeakRss(summary) })
            hasSentFirst = true
        }
    })

    process.on("message", (message: any) => {
        if(!message || message.type !== "close") return
        session.Close().then(() => process.exit(0))
    })

    return { exitAfterSend: false }
}

// Nenhuma saída sem resposta: um worker que morre calado deixa o pai esperando
// para sempre — o mesmo defeito que este projeto corrigiu no processo principal.
const _Fail = (error: any) => {
    _Send({
        type: "error",
        message: (error && (error.message || String(error))) || "falha desconhecida no worker de build",
        stack: error && error.stack
    })
    process.exit(1)
}

process.on("uncaughtException", _Fail)
process.on("unhandledRejection", _Fail)

const Start = (job: any) => {
    RunJob(job)
        .then(({ exitAfterSend }) => {
            // O canal IPC é assíncrono: sair no mesmo tick pode descartar a
            // última mensagem antes de ela chegar ao pai.
            if(exitAfterSend) setImmediate(() => process.exit(0))
        })
        .catch(_Fail)
}

if(process.send){
    process.once("message", (message: any) => {
        if(message && message.type === "build") Start(message.job)
    })
    _Send({ type: "ready" })
} else {
    // Modo linha de comando: `node BuildWorkerEntry.ts <caminho-do-job.json>`.
    // Serve para medir o custo de um build isolado, sem o pai no meio.
    const jobFile = process.argv[2]
    if(!jobFile){
        console.error("uso: node BuildWorkerEntry.ts <job.json>")
        process.exit(2)
    }
    Start(JSON.parse(fs.readFileSync(path.resolve(jobFile), "utf8")))
}
