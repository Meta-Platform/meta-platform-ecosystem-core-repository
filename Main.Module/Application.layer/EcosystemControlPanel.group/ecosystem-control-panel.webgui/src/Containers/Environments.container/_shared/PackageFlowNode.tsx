import * as React from "react"
import { Handle, Position } from "reactflow"

// Nó customizado dos diagramas: cartão colorido por tipo de pacote, com o nome
// em destaque e um "chip" descrevendo o papel (objectLoaderType ou tipo do pacote).
// data: { name, typeLabel, kindLabel, theme:{ bg, border } }
const PackageFlowNode = ({ data }: any) => {
    const theme = data.theme || { bg: "#f1f5f9", border: "#94a3b8" }
    const handleStyle = { background: theme.border, width: 8, height: 8, border: "none" }

    return (
        <div
            style={{
                minWidth: 180,
                maxWidth: 260,
                background: theme.bg,
                border: `1.5px solid ${theme.border}`,
                borderRadius: 8,
                padding: "8px 12px",
                boxShadow: "0 1px 2px rgba(15,23,42,.10)",
                fontFamily: "inherit",
            }}>
            <Handle type="target" position={Position.Top} style={handleStyle} />

            <div
                style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#1e293b",
                    lineHeight: 1.25,
                    wordBreak: "break-all",
                }}>
                {data.name}
            </div>

            {data.typeLabel ? (
                <div style={{ marginTop: 6 }}>
                    <span
                        style={{
                            display: "inline-block",
                            fontSize: 10,
                            fontWeight: 600,
                            letterSpacing: 0.3,
                            textTransform: "uppercase",
                            color: "#475569",
                            background: "rgba(255,255,255,.65)",
                            border: `1px solid ${theme.border}`,
                            borderRadius: 4,
                            padding: "1px 6px",
                        }}>
                        {data.typeLabel}
                    </span>
                </div>
            ) : null}

            <Handle type="source" position={Position.Bottom} style={handleStyle} />
        </div>
    )
}

export default React.memo(PackageFlowNode)
