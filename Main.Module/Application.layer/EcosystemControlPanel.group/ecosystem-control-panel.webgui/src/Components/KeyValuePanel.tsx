import * as React from "react"
import { Label, Table } from "semantic-ui-react"

import CopyValue from "./CopyValue"
import { TruncateMiddle } from "../Utils/Format"

// Renderiza um valor técnico de forma legível e SEM vazar do container:
// boolean como badge, número/string em monospace, path truncado no meio +
// copiar, objeto/array como JSON com scroll contido.
const MONO:any = { fontFamily: "monospace", fontSize: ".88em", color: "#2d333a" }

const RenderValue = (value:any) => {
    if(value === null || value === undefined)
        return <span style={{ color: "#bbb" }}>—</span>
    if(typeof value === "boolean")
        return <Label size="mini" basic color={value ? "green" : "grey"}>{String(value)}</Label>
    if(typeof value === "number")
        return <span style={{ ...MONO, color: "#1f6feb" }}>{value}</span>
    if(typeof value === "object")
        return <span style={{
            display: "block", whiteSpace: "pre-wrap", wordBreak: "break-all",
            maxHeight: "160px", overflow: "auto", fontFamily: "monospace", fontSize: ".8em",
            lineHeight: 1.4, color: "#57606a"
        }}>{JSON.stringify(value, null, 2)}</span>

    const s = String(value)
    const isPath = s.startsWith("/") || s.startsWith("~") || s.includes("/")
    const display = (isPath || s.length > 60) ? TruncateMiddle(s, 60) : s
    return <span style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
        <span title={s} style={{ ...MONO, flex: 1, minWidth: 0, wordBreak: "break-all" }}>{display}</span>
        { s.length > 16 && <CopyValue value={s}/> }
    </span>
}

// Rótulo da chave (monospace, discreto) — usado no modo empilhado.
const KeyLabel = ({ children }:any) =>
    <div style={{ fontFamily: "monospace", fontSize: ".78em", color: "#8a9099", fontWeight: 600, marginBottom: "2px", wordBreak: "break-all" }}>{children}</div>

// Painel chave-valor compacto que respeita a largura do container (não vaza).
// `stacked`: nome do parâmetro ACIMA do valor (otimiza espaço horizontal, ideal
// para o off-canvas estreito); padrão: duas colunas (nome ao lado do valor).
const KeyValuePanel = ({ data, stacked = false }:any) => {
    const keys = Object.keys(data || {}).filter((k) => data[k] !== undefined && data[k] !== null && data[k] !== "")
    if(keys.length === 0)
        return <span style={{ color: "#bbb" }}>sem dados</span>
    if(stacked)
        return <div>
            {
                keys.map((key:string, index:number) =>
                    <div key={index} style={{ padding: "8px 0", borderBottom: index < keys.length - 1 ? "1px solid #d7dce1" : "none" }}>
                        <KeyLabel>{key}</KeyLabel>
                        <div style={{ minWidth: 0 }}>{RenderValue(data[key])}</div>
                    </div>)
            }
        </div>
    return <Table basic compact unstackable style={{ tableLayout: "fixed", width: "100%" }}>
        <Table.Body>
            {
                keys.map((key:string, index:number) =>
                    <Table.Row key={index}>
                        <Table.Cell style={{ width: "38%", verticalAlign: "top", wordBreak: "break-all" }}>
                            <strong style={{ fontFamily: "monospace", fontSize: ".82em", color: "#444" }}>{key}</strong>
                        </Table.Cell>
                        <Table.Cell style={{ overflow: "hidden" }}>{RenderValue(data[key])}</Table.Cell>
                    </Table.Row>)
            }
        </Table.Body>
    </Table>
}

export default KeyValuePanel
