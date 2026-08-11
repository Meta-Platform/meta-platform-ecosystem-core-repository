import * as React from "react"
import { useEffect, useState } from "react"
import { ToastStack } from "@i-components"

import { subscribeToast, ToastMessage } from "../Utils/toast"

const TONE_BY_TYPE:any = {
    success: "success",
    error:   "danger",
    warning: "warning",
    info:    "info"
}

// Container fixo (canto inferior direito) que exibe os toasts e os remove
// automaticamente após alguns segundos.
const ToastContainer = () => {

    const [ toasts, setToasts ] = useState<ToastMessage[]>([])

    useEffect(() => subscribeToast((toast) => {
        setToasts((prev) => [ ...prev, toast ])
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== toast.id)), 4500)
    }), [])

    const dismiss = (id:string) => setToasts((prev) => prev.filter((t) => String(t.id) !== id))

    if(toasts.length === 0) return null

    return <ToastStack
        onDismiss={dismiss}
        toasts={toasts.map((toast) => ({
            id      : String(toast.id),
            tone    : TONE_BY_TYPE[toast.type] || "info",
            message : toast.message
        }))}/>
}

export default ToastContainer
