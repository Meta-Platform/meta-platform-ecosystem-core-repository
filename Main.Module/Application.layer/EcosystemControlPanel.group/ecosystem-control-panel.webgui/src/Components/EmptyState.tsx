import * as React from "react"
import { Icon } from "semantic-ui-react"

// Empty state padronizado: ícone + título + descrição + ação opcional.
// Sempre responde: o que está vazio, por quê e qual a próxima ação.
const EmptyState = ({ icon = "inbox", title, description, action, compact = false }:any) =>
    <div style={{ textAlign: "center", padding: compact ? "18px 12px" : "40px 20px", color: "var(--mp-muted)" }}>
        { React.isValidElement(icon)
            ? icon
            : <Icon name={icon} size={compact ? "large" : "big"} style={{ color: "var(--mp-line-soft)" }}/> }
        { title && <div style={{ marginTop: "10px", fontWeight: 700, color: "var(--mp-ink-2)", fontFamily: "var(--mp-font-display)" }}>{title}</div> }
        { description && <div style={{ marginTop: "4px", fontSize: ".9em" }}>{description}</div> }
        { action && <div style={{ marginTop: "12px" }}>{action}</div> }
    </div>

export default EmptyState
