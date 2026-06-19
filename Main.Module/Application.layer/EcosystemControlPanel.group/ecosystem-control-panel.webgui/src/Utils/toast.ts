// Pub/sub leve para toasts de feedback de ações (sucesso/erro/aviso/info),
// sem depender de redux. O ToastContainer assina e renderiza.
export type ToastType = "success" | "error" | "warning" | "info"
export interface ToastMessage { id: number; type: ToastType; message: string }

type Listener = (toast: ToastMessage) => void

let listeners: Listener[] = []
let counter = 0

export const subscribeToast = (fn: Listener) => {
    listeners.push(fn)
    return () => { listeners = listeners.filter((l) => l !== fn) }
}

export const showToast = (message: string, type: ToastType = "info") => {
    const toast: ToastMessage = { id: ++counter, type, message }
    listeners.forEach((l) => l(toast))
}

// Atalhos
export const toastSuccess = (m: string) => showToast(m, "success")
export const toastError   = (m: string) => showToast(m, "error")

// Normaliza um erro (string, Error, axios) para mensagem legível.
export const errorMessage = (e: any): string => {
    if(!e) return "Erro desconhecido"
    if(typeof e === "string") return e
    if(e.response && e.response.data) return typeof e.response.data === "string" ? e.response.data : JSON.stringify(e.response.data)
    return e.message || String(e)
}
