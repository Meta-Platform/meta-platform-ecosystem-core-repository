// Store global (pub/sub) das janelas de log stream.
// Uma janela = um stream de log de um socket. Pode ser minimizada (continua
// conectada, preservando histórico) ou fechada (perde o histórico).
// Apenas uma janela fica expandida por vez (offcanvas à direita); as demais
// ficam no dock.

export type LogWindow = {
    id: string
    monitoringStateKey: string
    socketName: string
    minimized: boolean
}

let windows: LogWindow[] = []
const listeners = new Set<(w: LogWindow[]) => void>()

const _snapshot = () => windows.map((w) => ({ ...w }))
const _emit = () => { const snap = _snapshot(); listeners.forEach((l) => l(snap)) }

export const subscribeLogWindows = (cb: (w: LogWindow[]) => void) => {
    listeners.add(cb)
    cb(_snapshot())
    return () => { listeners.delete(cb) }
}

export const getLogWindows = () => _snapshot()

// Abre (ou foca) a janela de log de um socket. Se já existe, expande-a.
export const openLogWindow = ({ monitoringStateKey, socketName }: { monitoringStateKey: string, socketName: string }) => {
    const existing = windows.find((w) => w.monitoringStateKey === monitoringStateKey)
    if(existing){
        windows = windows.map((w) => ({ ...w, minimized: w.id !== existing.id }))
    } else {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        windows = [ ...windows.map((w) => ({ ...w, minimized: true })), { id, monitoringStateKey, socketName, minimized: false } ]
    }
    _emit()
}

export const expandLogWindow = (id: string) => {
    windows = windows.map((w) => ({ ...w, minimized: w.id !== id }))
    _emit()
}

export const minimizeLogWindow = (id: string) => {
    windows = windows.map((w) => (w.id === id ? { ...w, minimized: true } : w))
    _emit()
}

export const closeLogWindow = (id: string) => {
    windows = windows.filter((w) => w.id !== id)
    _emit()
}
