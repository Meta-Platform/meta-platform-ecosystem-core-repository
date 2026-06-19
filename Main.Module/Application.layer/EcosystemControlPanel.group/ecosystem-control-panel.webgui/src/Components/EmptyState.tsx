import * as React from "react"
import { Icon } from "semantic-ui-react"

// Empty state padronizado: ícone + título + descrição + ação opcional.
// Sempre responde: o que está vazio, por quê e qual a próxima ação.
const EmptyState = ({ icon = "inbox", title, description, action, compact = false }:any) =>
    <div style={{ textAlign: "center", padding: compact ? "18px 12px" : "40px 20px", color: "#9aa0a6" }}>
        <Icon name={icon} size={compact ? "large" : "big"} style={{ color: "#dcdcdc" }}/>
        { title && <div style={{ marginTop: "10px", fontWeight: 600, color: "#6b7177" }}>{title}</div> }
        { description && <div style={{ marginTop: "4px", fontSize: ".9em" }}>{description}</div> }
        { action && <div style={{ marginTop: "12px" }}>{action}</div> }
    </div>

export default EmptyState
