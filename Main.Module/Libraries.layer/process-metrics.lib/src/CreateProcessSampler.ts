import type { ProcStat, ProcessSample, SystemSample } from "./Types"

const fs = require("fs") as typeof import("fs")
const os = require("os") as typeof import("os")

// Amostragem de uso de CPU/memória/IO a partir do `/proc` do Linux.
//
// Por que ler /proc à mão em vez de usar uma dependência: o daemon
// `executor-manager` é o núcleo da execução do ecossistema e roda empacotado
// (pkg). Toda dependência nativa nova é um risco de build e de runtime para o
// componente que NÃO pode falhar. /proc é um arquivo de texto — ler é barato,
// não tem binding nativo e não some numa atualização de versão.
//
// Em SO sem /proc (Windows/macOS) nada explode: cada campo indisponível volta
// como `undefined` e quem consome decide o que mostrar.

// USER_HZ — a unidade em que o kernel reporta tempo de CPU no /proc. Não há
// sysconf(_SC_CLK_TCK) em Node puro; 100 é o valor de todo Linux corrente
// (CONFIG_HZ_100 no userspace ABI, fixo desde o kernel 2.6).
const DEFAULT_CLOCK_TICKS = 100

const PROC_DIR = "/proc"

const _ReadFile = (path: string): string | undefined => {
    try { return fs.readFileSync(path, "utf8") }
    catch(e) { return undefined }
}

// O campo `comm` do /proc/<pid>/stat é o nome do executável ENTRE PARÊNTESES e
// pode conter espaços e parênteses ("(Web Content)", "(a (b) c)"). Fatiar por
// espaço direto quebra a numeração de todos os campos seguintes — por isso o
// corte é feito no ÚLTIMO ")" da linha.
//
// Depois desse corte, o primeiro token é o campo 3 (state), então o campo N do
// `man 5 proc` está em `fields[N - 3]`.
const _ParseStat = (raw?: string): ProcStat | undefined => {
    if(!raw) return undefined
    const closingIndex = raw.lastIndexOf(")")
    if(closingIndex < 0) return undefined

    const pid    = Number(raw.slice(0, raw.indexOf("(")).trim())
    const fields = raw.slice(closingIndex + 2).trim().split(/\s+/)

    const _field = (number: number) => fields[number - 3]

    return {
        pid,
        state:      _field(3),
        ppid:       Number(_field(4)),
        pgrp:       Number(_field(5)),
        utime:      Number(_field(14)),
        stime:      Number(_field(15)),
        numThreads: Number(_field(20)),
        starttime:  Number(_field(22)),
        rssPages:   Number(_field(24))
    }
}

// VmRSS do /proc/<pid>/status vem em kB. `statm` seria mais barato, mas conta
// páginas de tamanho variável — o valor em kB é o mesmo que o htop mostra.
const _ParseStatusRssBytes = (raw?: string): number | undefined => {
    if(!raw) return undefined
    const match = raw.match(/^VmRSS:\s+(\d+)\s+kB/m)
    return match ? Number(match[1]) * 1024 : undefined
}

// /proc/<pid>/io só é legível pelo dono do processo (ou root): para instância de
// outro usuário volta EACCES, e aí simplesmente não há IO a mostrar.
const _ParseIo = (raw?: string): { ioReadBytes?: number, ioWriteBytes?: number } => {
    if(!raw) return {}
    const _value = (key: string) => {
        const match = raw.match(new RegExp(`^${key}:\\s+(\\d+)`, "m"))
        return match ? Number(match[1]) : undefined
    }
    return { ioReadBytes: _value("read_bytes"), ioWriteBytes: _value("write_bytes") }
}

const _ReadSystemUptimeSeconds = (): number | undefined => {
    const raw = _ReadFile(`${PROC_DIR}/uptime`)
    if(!raw) return undefined
    return Number(raw.trim().split(/\s+/)[0])
}

// MemAvailable é a memória que o sistema pode entregar sem swap — é o número que
// o usuário reconhece como "livre". `os.freemem()` ignora cache reclamável e
// assusta sem motivo (mostra quase zero numa máquina saudável).
const _ReadMemoryInfo = () => {
    const raw = _ReadFile(`${PROC_DIR}/meminfo`)
    if(!raw) return { totalMemBytes: os.totalmem(), availableMemBytes: os.freemem() }

    const _value = (key: string) => {
        const match = raw.match(new RegExp(`^${key}:\\s+(\\d+)\\s+kB`, "m"))
        return match ? Number(match[1]) * 1024 : undefined
    }
    return {
        totalMemBytes:     _value("MemTotal")     ?? os.totalmem(),
        availableMemBytes: _value("MemAvailable") ?? os.freemem()
    }
}

const _ReadSystemCpuTimes = (): { total: number, idle: number } | undefined => {
    const raw = _ReadFile(`${PROC_DIR}/stat`)
    if(!raw) return undefined

    const line = raw.split("\n").find((l) => l.startsWith("cpu "))
    if(!line) return undefined

    const values = line.trim().split(/\s+/).slice(1).map(Number)
    const total  = values.reduce((sum, value) => sum + value, 0)
    // idle + iowait: o tempo em que a CPU não estava fazendo trabalho útil.
    const idle   = (values[3] || 0) + (values[4] || 0)
    return { total, idle }
}

/**
 * Sampler de processos. É STATEFUL de propósito: uso de CPU não é um valor que
 * se lê, é a DERIVADA de um contador acumulado. A primeira amostra de um pid
 * serve só para estabelecer a linha de base e volta com `cpuPercent: 0` — só a
 * segunda em diante mede de verdade.
 *
 * `SampleProcessGroup` existe porque uma instância desktop não é um processo: o
 * daemon faz spawn de `run package` com `detached: true` (logo pgid = pid) e
 * esse `run` sobe o Electron, que por sua vez tem processos de GPU e de
 * renderer. Medir só o pid registrado mostraria ~0% de CPU e alguns MB, o que é
 * pior do que não mostrar nada. Somar o GRUPO mede a aplicação inteira.
 */
const CreateProcessSampler = ({ clockTicks = DEFAULT_CLOCK_TICKS }: { clockTicks?: number } = {}) => {

    // chave → { cpuTicks, atMs }. A chave separa os espaços ("p:" processo,
    // "g:" grupo) para que medir os dois não misture as linhas de base.
    const previousByKey = new Map<string, { cpuTicks: number, atMs: number }>()
    let previousSystemCpu: { total: number, idle: number } | undefined

    const _CpuPercent = (key: string, cpuTicks: number, atMs: number): number => {
        const previous = previousByKey.get(key)
        previousByKey.set(key, { cpuTicks, atMs })

        if(!previous) return 0

        const elapsedSeconds = (atMs - previous.atMs) / 1000
        if(elapsedSeconds <= 0) return 0

        const usedSeconds = (cpuTicks - previous.cpuTicks) / clockTicks
        // Contador pode "voltar" quando um processo do grupo morre entre duas
        // amostras (o tempo dele sai da soma). Negativo vira 0, não NaN.
        if(usedSeconds < 0) return 0

        return Number(((usedSeconds / elapsedSeconds) * 100).toFixed(1))
    }

    // Varredura única de /proc, usada pela medição por grupo. Os diretórios
    // numéricos são os processos; qualquer um pode sumir no meio da leitura
    // (processo terminou), e nesse caso é simplesmente ignorado.
    const _ScanProcesses = () => {
        let entries: string[]
        try { entries = fs.readdirSync(PROC_DIR) }
        catch(e) { return undefined }

        return entries
            .filter((entry) => /^\d+$/.test(entry))
            .map((entry) => _ParseStat(_ReadFile(`${PROC_DIR}/${entry}/stat`)))
            .filter(Boolean) as ProcStat[]
    }

    const _Uptime = (starttime: number): number | undefined => {
        const systemUptime = _ReadSystemUptimeSeconds()
        if(systemUptime === undefined || !Number.isFinite(starttime)) return undefined
        return Math.max(0, Math.round(systemUptime - (starttime / clockTicks)))
    }

    // Um processo isolado, pelo seu pid.
    const SampleProcess = (pid?: number): ProcessSample | undefined => {
        if(!pid) return undefined

        const stat = _ParseStat(_ReadFile(`${PROC_DIR}/${pid}/stat`))
        if(!stat) return undefined

        const atMs = Date.now()
        const rssBytes = _ParseStatusRssBytes(_ReadFile(`${PROC_DIR}/${pid}/status`))

        return {
            pid,
            processCount:  1,
            cpuPercent:    _CpuPercent(`p:${pid}`, stat.utime + stat.stime, atMs),
            rssBytes:      rssBytes ?? (Number.isFinite(stat.rssPages) ? stat.rssPages * 4096 : undefined),
            threads:       stat.numThreads,
            uptimeSeconds: _Uptime(stat.starttime),
            ..._ParseIo(_ReadFile(`${PROC_DIR}/${pid}/io`))
        }
    }

    // O processo `pgid` e todos os que compartilham o grupo dele — a aplicação
    // inteira (`run` + Electron + renderers), não só o processo lançador.
    //
    // Nota sobre RSS: somar o RSS dos processos conta duas vezes a memória
    // compartilhada entre eles. É a mesma aproximação que o Gerenciador de
    // Tarefas do Windows faz por árvore, e o erro é para cima — quem consome
    // sabe que é o total do grupo, não memória exclusiva.
    const SampleProcessGroup = (pgid?: number): ProcessSample | undefined => {
        if(!pgid) return undefined

        const processList = _ScanProcesses()
        if(!processList) return undefined

        const groupList = processList.filter((process) => process.pgrp === pgid)
        if(groupList.length === 0) return undefined

        const atMs = Date.now()
        const cpuTicks = groupList.reduce((sum, process) => sum + process.utime + process.stime, 0)
        const threads  = groupList.reduce((sum, process) => sum + (process.numThreads || 0), 0)

        const rssBytes = groupList.reduce((sum, process) => {
            const rss = _ParseStatusRssBytes(_ReadFile(`${PROC_DIR}/${process.pid}/status`))
                ?? (Number.isFinite(process.rssPages) ? process.rssPages * 4096 : 0)
            return sum + rss
        }, 0)

        const io = groupList.reduce((acc: { ioReadBytes?: number, ioWriteBytes?: number }, process) => {
            const { ioReadBytes, ioWriteBytes } = _ParseIo(_ReadFile(`${PROC_DIR}/${process.pid}/io`))
            return {
                ioReadBytes:  ioReadBytes  === undefined ? acc.ioReadBytes  : (acc.ioReadBytes  || 0) + ioReadBytes,
                ioWriteBytes: ioWriteBytes === undefined ? acc.ioWriteBytes : (acc.ioWriteBytes || 0) + ioWriteBytes
            }
        }, {})

        // O uptime do grupo é o do líder (o processo que o daemon lançou).
        const leader = groupList.find((process) => process.pid === pgid) || groupList[0]

        return {
            pid:           pgid,
            processCount:  groupList.length,
            cpuPercent:    _CpuPercent(`g:${pgid}`, cpuTicks, atMs),
            rssBytes,
            threads,
            uptimeSeconds: _Uptime(leader.starttime),
            ...io
        }
    }

    // Estado da máquina. `cpuPercent` aqui é 0–100 do total de núcleos (a visão
    // de "quanto do computador está ocupado"), diferente do por-processo, que é
    // relativo a UM núcleo e pode passar de 100 num processo multithread.
    const SampleSystem = (): SystemSample => {
        const { totalMemBytes, availableMemBytes } = _ReadMemoryInfo()
        const cpuTimes = _ReadSystemCpuTimes()

        let cpuPercent: number | undefined
        if(cpuTimes){
            if(previousSystemCpu){
                const totalDelta = cpuTimes.total - previousSystemCpu.total
                const idleDelta  = cpuTimes.idle  - previousSystemCpu.idle
                cpuPercent = totalDelta > 0
                    ? Number((((totalDelta - idleDelta) / totalDelta) * 100).toFixed(1))
                    : 0
            } else cpuPercent = 0
            previousSystemCpu = cpuTimes
        }

        return {
            cpuPercent,
            cpuCount:          os.cpus().length,
            totalMemBytes,
            availableMemBytes,
            usedMemBytes:      totalMemBytes - availableMemBytes,
            loadAverage:       os.loadavg(),
            uptimeSeconds:     Math.round(os.uptime())
        }
    }

    // Descarta a linha de base de algo que morreu. Sem isto, o Map cresceria
    // para sempre num daemon que fica meses no ar.
    const Forget = (pidOrPgid: number) => {
        previousByKey.delete(`p:${pidOrPgid}`)
        previousByKey.delete(`g:${pidOrPgid}`)
    }

    // Está disponível a leitura de /proc nesta máquina?
    const IsSupported = () => fs.existsSync(`${PROC_DIR}/self/stat`)

    return Object.freeze({
        SampleProcess,
        SampleProcessGroup,
        SampleSystem,
        Forget,
        IsSupported
    })
}

module.exports = CreateProcessSampler
