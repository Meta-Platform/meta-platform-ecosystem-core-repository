const fs = require("fs")
const { readdir, stat } = require('node:fs/promises')
const { resolve, join, basename } = require("path")

/*
 * Leitura do histórico de log do ecossistema.
 *
 * O que existe em disco (ver logging-standard.md):
 *
 *   <EcosystemData>/logs/ecosystem/<data>.jsonl
 *   <EcosystemData>/logs/applications/<pacote>/<data>.jsonl
 *   <EcosystemData>/logs/instances/<instanceId>.jsonl
 *   <EcosystemData>/environments/<pacote>-<hash>/logs/<data>.jsonl
 *
 * Duas regras que orientam a implementação:
 *
 *   1. Nunca carregar um arquivo inteiro em memória. Um log de sessão longa tem
 *      dezenas de MB; a leitura é sempre de uma FATIA, a partir do fim ou de um
 *      offset conhecido.
 *   2. Ler log não pode derrubar o painel. Arquivo ausente, ilegível ou com
 *      linha corrompida devolve resultado vazio ou parcial — nunca exceção.
 */

const LOGS_DIRNAME       = "logs"
const READ_MAX_BYTES     = 512 * 1024
const DEFAULT_PAGE_LINES = 500

const LEVEL_ORDER = ["trace", "debug", "info", "message", "warn", "error", "fatal"]

const LogReaderService = (params) => {

    const {
        ecosystemdataHandlerService,
        ecosystemDefaultsFileRelativePath,
        jsonFileUtilitiesLib,
        onReady
    } = params

    const ReadJsonFile = jsonFileUtilitiesLib.require("ReadJsonFile")

    let logsDirPath          = undefined
    let environmentsDirPath  = undefined

    const _Start = async () => {
        const ecosystemDataPath = ecosystemdataHandlerService.GetEcosystemDataPath()
        const ecosystemDefaults = await ReadJsonFile(resolve(ecosystemDataPath, ecosystemDefaultsFileRelativePath))

        logsDirPath = resolve(ecosystemDataPath, ecosystemDefaults.LOG_CONF_DIRNAME_LOGS || LOGS_DIRNAME)
        environmentsDirPath = resolve(ecosystemDataPath, ecosystemDefaults.ECOSYSTEMDATA_CONF_DIRNAME_EXECUTION_DATA_DIR)

        onReady()
    }

    const _ListFilesSafe = async (dirPath) => {
        try {
            return (await readdir(dirPath, { withFileTypes : true }))
                .filter((entry) => entry.isFile() && entry.name.endsWith(".jsonl"))
                .map((entry) => entry.name)
                .sort()
        } catch (e) { return [] }
    }

    const _ListDirsSafe = async (dirPath) => {
        try {
            return (await readdir(dirPath, { withFileTypes : true }))
                .filter((entry) => entry.isDirectory())
                .map((entry) => entry.name)
                .sort()
        } catch (e) { return [] }
    }

    const _DescribeFile = async (filePath, name) => {
        try {
            const info = await stat(filePath)
            return { name, path : filePath, size : info.size, modifiedAt : info.mtime.toISOString() }
        } catch (e) {
            return { name, path : filePath, size : 0, modifiedAt : null }
        }
    }

    /*
     * A ÁRVORE do que existe: é o que o painel usa para montar o navegador. Cada
     * folha traz o caminho, que volta na leitura — o cliente não monta caminho.
     */
    const GetLogTree = async () => {

        const ecosystemFiles = await _ListFilesSafe(join(logsDirPath, "ecosystem"))
        const instanceFiles  = await _ListFilesSafe(join(logsDirPath, "instances"))
        const applicationDirs = await _ListDirsSafe(join(logsDirPath, "applications"))

        const applications = []
        for (const applicationName of applicationDirs) {
            const dirPath = join(logsDirPath, "applications", applicationName)
            const files = await _ListFilesSafe(dirPath)
            applications.push({
                name  : applicationName,
                files : await Promise.all(files.map((name) => _DescribeFile(join(dirPath, name), name)))
            })
        }

        const environments = []
        for (const environmentName of await _ListDirsSafe(environmentsDirPath)) {
            const dirPath = join(environmentsDirPath, environmentName, LOGS_DIRNAME)
            const files = await _ListFilesSafe(dirPath)
            if (files.length === 0) continue
            environments.push({
                name  : environmentName,
                files : await Promise.all(files.map((name) => _DescribeFile(join(dirPath, name), name)))
            })
        }

        return {
            ecosystem    : await Promise.all(ecosystemFiles.map((name) => _DescribeFile(join(logsDirPath, "ecosystem", name), name))),
            applications,
            instances    : await Promise.all(instanceFiles.map((name) => _DescribeFile(join(logsDirPath, "instances", name), name))),
            environments
        }
    }

    /*
     * Um caminho só é aceito se estiver DENTRO das áreas de log conhecidas — o
     * cliente manda o caminho que a árvore devolveu, e nada além disso.
     */
    const _IsPathAllowed = (filePath) => {
        const resolved = resolve(filePath)
        return resolved.startsWith(resolve(logsDirPath)) || resolved.startsWith(resolve(environmentsDirPath))
    }

    /* Lê uma fatia do fim do arquivo, ou a partir de `fromOffset`. */
    const _ReadSlice = (filePath, { fromOffset, maxBytes = READ_MAX_BYTES }) => {

        const { size } = fs.statSync(filePath)

        /* Offset maior que o arquivo = ele rodou/truncou desde a última leitura. */
        const rotated = fromOffset !== undefined && fromOffset > size
        const start = (fromOffset !== undefined && !rotated) ? fromOffset : Math.max(0, size - maxBytes)

        if (start >= size) return { lines : [], offset : size, size, rotated }

        const length = Math.min(size - start, maxBytes)
        const buffer = Buffer.alloc(length)

        const fd = fs.openSync(filePath, "r")
        try { fs.readSync(fd, buffer, 0, length, start) }
        finally { try { fs.closeSync(fd) } catch (e) {} }

        let text = buffer.toString("utf8")

        /* Começando no meio, a primeira linha vem cortada: descartar. */
        if (start > 0 && fromOffset === undefined) {
            const firstBreak = text.indexOf("\n")
            if (firstBreak >= 0) text = text.slice(firstBreak + 1)
        }

        const lines = text.split("\n")
        const pendingBytes = Buffer.byteLength(lines[lines.length - 1], "utf8")
        lines.pop()

        return { lines, offset : (start + length) - pendingBytes, size, rotated }
    }

    /*
     * Uma linha que não é JSON não é descartada: vira um registro com o texto
     * cru. É o caso do stdout de um processo desktop, que se mistura ao JSONL
     * no arquivo da instância.
     */
    const _ParseLine = (line) => {

        if (!line) return null

        if (line[0] !== "{") {
            return { ts : null, level : "message", source : "<raw>", message : line, data : null, raw : true }
        }

        try {
            const record = JSON.parse(line)
            return (record && record.message !== undefined) ? record : null
        } catch (e) {
            return { ts : null, level : "message", source : "<raw>", message : line, data : null, raw : true }
        }
    }

    const _Matches = (record, { level, source, text, since, until }) => {

        if (level) {
            const floor = LEVEL_ORDER.indexOf(level)
            const current = LEVEL_ORDER.indexOf(record.level)
            if (floor >= 0 && current >= 0 && current < floor) return false
        }

        if (source && !String(record.source || "").toLowerCase().includes(String(source).toLowerCase())) return false

        if (text) {
            const alvo = `${record.message} ${record.source} ${record.data ? JSON.stringify(record.data) : ""}`.toLowerCase()
            if (!alvo.includes(String(text).toLowerCase())) return false
        }

        if (since && record.ts && record.ts < since) return false
        if (until && record.ts && record.ts > until) return false

        return true
    }

    /*
     * Leitura paginada com filtro. `offset` volta ao chamador para continuar de
     * onde parou — é o que torna o acompanhamento incremental.
     */
    const ReadLog = async ({ path, fromOffset, maxLines = DEFAULT_PAGE_LINES, level, source, text, since, until } = {}) => {

        if (!path) throw new Error("ReadLog: 'path' é obrigatório.")
        if (!_IsPathAllowed(path)) throw new Error("ReadLog: caminho fora das áreas de log do ecossistema.")

        let slice
        try { slice = _ReadSlice(path, { fromOffset }) }
        catch (e) { return { path, exists : false, records : [], offset : 0, size : 0 } }

        const filtro = { level, source, text, since, until }

        const records = slice.lines
            .map(_ParseLine)
            .filter(Boolean)
            .filter((record) => _Matches(record, filtro))

        return {
            path,
            exists  : true,
            records : records.length > maxLines ? records.slice(records.length - maxLines) : records,
            offset  : slice.offset,
            size    : slice.size,
            rotated : slice.rotated
        }
    }

    _Start()

    return {
        controllerName : "LogReaderService",
        GetLogTree,
        ReadLog,
        /* Exposto para o controller montar o follow por WebSocket. */
        IsPathAllowed  : _IsPathAllowed,
        GetLogsDirPath : () => logsDirPath
    }
}

module.exports = LogReaderService
