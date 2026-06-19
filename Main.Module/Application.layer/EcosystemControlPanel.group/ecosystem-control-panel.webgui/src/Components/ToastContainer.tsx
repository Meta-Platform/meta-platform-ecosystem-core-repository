import * as React from "react"
import { useEffect, useState } from "react"
import { Message } from "semantic-ui-react"

import { subscribeToast, ToastMessage } from "../Utils/toast"

const TYPE_PROPS:any = {
    success: { positive: true, icon: "check circle" },
    error:   { negative: true, icon: "times circle" },
    warning: { warning: true,  icon: "warning sign" },
    info:    { info: true,     icon: "info circle" }
}

// Container fixo (canto inferior direito) que exibe os toasts e os remove
// automaticamente após alguns segundos.
const ToastContainer = () => {

    const [ toasts, setToasts ] = useState<ToastMessage[]>([])

    useEffect(() => subscribeToast((toast) => {
        setToasts((prev) => [ ...prev, toast ])
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== toast.id)), 4500)
    }), [])

    const dismiss = (id:number) => setToasts((prev) => prev.filter((t) => t.id !== id))

    if(toasts.length === 0) return null

    return <div style={{ position: "fixed", bottom: "16px", right: "16px", zIndex: 2000, display: "flex", flexDirection: "column", gap: "8px", maxWidth: "380px" }}>
        {
            toasts.map((toast) => {
                const props = TYPE_PROPS[toast.type] || TYPE_PROPS.info
                return <Message
                    key={toast.id}
                    {...props}
                    onDismiss={() => dismiss(toast.id)}
                    style={{ margin: 0, boxShadow: "0 2px 10px rgba(16,24,40,.18)" }}>
                    <Message.Content style={{ wordBreak: "break-word" }}>{toast.message}</Message.Content>
                </Message>
            })
        }
    </div>
}

export default ToastContainer
