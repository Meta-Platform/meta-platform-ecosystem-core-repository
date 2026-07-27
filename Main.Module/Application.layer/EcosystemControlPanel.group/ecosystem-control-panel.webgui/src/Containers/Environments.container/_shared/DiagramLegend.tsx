import * as React from "react"
import { Panel } from "reactflow"

// Legenda fixa (canto superior direito). Mostra as cores dos tipos de nó
// presentes e, opcionalmente, o significado dos estilos de linha das arestas.
interface Kind { label: string; theme: { bg: string; border: string } }
interface Relation { label: string; dashed: boolean; color: string }

const DiagramLegend = ({ kinds, relations }: { kinds: Kind[]; relations?: Relation[] }) => {
    if ((!kinds || kinds.length === 0) && (!relations || relations.length === 0)) return null

    return (
        <Panel position="top-right">
            <div
                style={{
                    background: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: "10px 12px",
                    fontSize: 11,
                    lineHeight: 1.4,
                    boxShadow: "0 2px 8px rgba(15,23,42,.10)",
                    maxWidth: 210,
                }}>
                <div
                    style={{
                        fontWeight: 700,
                        fontSize: 10,
                        letterSpacing: 0.5,
                        textTransform: "uppercase",
                        color: "#334155",
                        marginBottom: 6,
                    }}>
                    Legenda
                </div>

                {(kinds || []).map((k) => (
                    <div key={k.label} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                        <span
                            style={{
                                width: 12,
                                height: 12,
                                borderRadius: 3,
                                background: k.theme.bg,
                                border: `1.5px solid ${k.theme.border}`,
                                flex: "0 0 auto",
                            }}
                        />
                        <span style={{ color: "#475569" }}>{k.label}</span>
                    </div>
                ))}

                {relations && relations.length > 0 ? (
                    <div style={{ borderTop: "1px solid #edf1f5", marginTop: 6, paddingTop: 6 }}>
                        {relations.map((r) => (
                            <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                                <span
                                    style={{
                                        width: 20,
                                        height: 0,
                                        borderTop: `2px ${r.dashed ? "dashed" : "solid"} ${r.color}`,
                                        flex: "0 0 auto",
                                    }}
                                />
                                <span style={{ color: "#475569" }}>{r.label}</span>
                            </div>
                        ))}
                    </div>
                ) : null}
            </div>
        </Panel>
    )
}

export default DiagramLegend
