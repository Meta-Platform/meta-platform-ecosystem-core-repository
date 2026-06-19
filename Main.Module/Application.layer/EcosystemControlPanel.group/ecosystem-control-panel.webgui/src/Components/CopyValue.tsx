import * as React from "react"
import { useState } from "react"
import { Button, Icon, Popup } from "semantic-ui-react"

// Botão discreto para copiar um valor técnico (ID, socket, path) para a área
// de transferência, com feedback visual.
const CopyValue = ({ value, size = "mini" }:any) => {

    const [ copied, setCopied ] = useState(false)

    const handleCopy = (e:any) => {
        e.stopPropagation()
        try {
            if(navigator.clipboard) navigator.clipboard.writeText(value)
        } catch(_) { /* ignore */ }
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
    }

    return <Popup
        size="tiny"
        content={copied ? "copiado!" : "copiar"}
        trigger={
            <Button
                icon
                basic
                size={size}
                onClick={handleCopy}
                style={{ padding: "4px", boxShadow: "none" }}>
                <Icon name={copied ? "check" : "copy outline"} color={copied ? "green" : undefined}/>
            </Button>
        }/>
}

export default CopyValue
