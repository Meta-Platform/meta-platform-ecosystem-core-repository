// Store global (pub/sub) das janelas de runtime (logs e terminais de execução).
// Uma janela = um stream (log de um socket) OU um terminal de execução de um app.
// Cada janela tem um MODO:
//   - "minimized": só no dock inferior (continua montada/conectada, preserva histórico)
//   - "offcanvas": ancorada à direita (um por vez)
//   - "floating":  janela flutuante, arrastável/redimensionável (várias ao mesmo tempo)
// As janelas ficam sempre montadas; trocar de modo nunca perde a conexão.

export type RuntimeWindowMode = "minimized" | "offcanvas" | "floating"
export type RuntimeWindowKind = "log" | "exec"

export type FloatGeometry = { x: number, y: number, width: number, height: number }

export type LogWindow = {
    id: string
    kind: RuntimeWindowKind
    mode: RuntimeWindowMode
    // último modo não-minimizado, para restaurar do dock no mesmo modo (flutuante
    // volta flutuante, com a mesma posição/tamanho; offcanvas volta offcanvas)
    lastMode?: RuntimeWindowMode
    title: string
    z: number
    // log
    monitoringStateKey?: string
    socketName?: string
    // exec
    packageDirPath?: string
    executableName?: string
    // geometria da janela flutuante (preservada enquanto montada)
    float?: FloatGeometry
}

let windows: LogWindow[] = []
let zCounter = 10
let floatCounter = 0
const listeners = new Set<(w: LogWindow[]) => void>()

const _snapshot = () => windows.map((w) => ({ ...w, float: w.float ? { ...w.float } : undefined }))
const _emit = () => { const snap = _snapshot(); listeners.forEach((l) => l(snap)) }

export const subscribeLogWindows = (cb: (w: LogWindow[]) => void) => {
    listeners.add(cb)
    cb(_snapshot())
    return () => { listeners.delete(cb) }
}

export const getLogWindows = () => _snapshot()

const _nextId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

// geometria padrão de uma nova flutuante: centralizada, escalonando cada abertura
const _defaultFloat = ():FloatGeometry => {
    const width = 720, height = 420
    const offset = (floatCounter++ % 6) * 30
    const vw = typeof window !== "undefined" ? window.innerWidth : 1280
    const x = Math.max(20, Math.round((vw - width) / 2) - 60 + offset)
    const y = 84 + offset
    return { x, y, width, height }
}

// garante um único offcanvas: ao ancorar um à direita, os outros offcanvas voltam
// a ser minimizados (as flutuantes permanecem).
const _soloOffcanvas = (id: string) => {
    windows = windows.map((w) => (w.id !== id && w.mode === "offcanvas") ? { ...w, mode: "minimized" } : w)
}

export const focusWindow = (id: string) => {
    windows = windows.map((w) => (w.id === id ? { ...w, z: ++zCounter } : w))
    _emit()
}

export const setWindowMode = (id: string, mode: RuntimeWindowMode) => {
    windows = windows.map((w) => {
        if(w.id !== id) return w
        const next: LogWindow = { ...w, mode, z: ++zCounter }
        // ao minimizar, lembra o modo atual para restaurar nele depois
        if(mode === "minimized" && w.mode !== "minimized") next.lastMode = w.mode
        if(mode === "floating" && !next.float) next.float = _defaultFloat()
        return next
    })
    if(mode === "offcanvas") _soloOffcanvas(id)
    _emit()
}

export const minimizeLogWindow = (id: string) => setWindowMode(id, "minimized")

export const floatWindow = (id: string) => setWindowMode(id, "floating")

export const dockRightWindow = (id: string) => setWindowMode(id, "offcanvas")

export const closeLogWindow = (id: string) => {
    windows = windows.filter((w) => w.id !== id)
    _emit()
}

// Clique no chip do dock: minimizado → restaura no ÚLTIMO modo (flutuante volta
// flutuante com a mesma posição/tamanho); visível → minimiza.
export const expandLogWindow = (id: string) => {
    const w = windows.find((x) => x.id === id)
    if(!w) return
    if(w.mode === "minimized") setWindowMode(id, w.lastMode || "offcanvas")
    else focusWindow(id)
}

export const updateFloatGeometry = (id: string, geo: FloatGeometry) => {
    windows = windows.map((w) => (w.id === id ? { ...w, float: { ...geo } } : w))
    _emit()
}

// Abre (ou foca) a janela de log de um socket.
export const openLogWindow = ({ monitoringStateKey, socketName }: { monitoringStateKey: string, socketName: string }) => {
    const existing = windows.find((w) => w.kind === "log" && w.monitoringStateKey === monitoringStateKey)
    if(existing){
        if(existing.mode === "minimized") setWindowMode(existing.id, "offcanvas")
        else focusWindow(existing.id)
        return existing.id
    }
    const id = _nextId()
    windows = [ ...windows, { id, kind: "log", mode: "offcanvas", title: socketName, z: ++zCounter, monitoringStateKey, socketName } ]
    _soloOffcanvas(id)
    _emit()
    return id
}

// Abre uma nova janela de terminal de execução de um app (cada execução = 1 janela).
export const openExecWindow = ({ packageDirPath, executableName }: { packageDirPath: string, executableName: string }) => {
    const id = _nextId()
    windows = [ ...windows, { id, kind: "exec", mode: "offcanvas", title: executableName, z: ++zCounter, packageDirPath, executableName } ]
    _soloOffcanvas(id)
    _emit()
    return id
}
