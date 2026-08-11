import * as React from "react"
import { useState } from "react"
import { Icon, Tooltip } from "@i-components"

// Botão discreto para copiar um valor técnico (ID, socket, path) para a área
// de transferência, com feedback visual.
const CopyValue = ({ value }:any) => {

    const [ copied, setCopied ] = useState(false)

    const handleCopy = (event:any) => {
        event.stopPropagation()
        try {
            if(navigator.clipboard) navigator.clipboard.writeText(value)
        } catch(_) { /* ignore */ }
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
    }

    return <Tooltip content={copied ? "copiado!" : "copiar"}>
        <button type="button" className="mp-copyable__btn" onClick={handleCopy} aria-label="copiar">
            <Icon name={copied ? "check" : "copy outline"} tone={copied ? "success" : "inherit"}/>
        </button>
    </Tooltip>
}

export default CopyValue
