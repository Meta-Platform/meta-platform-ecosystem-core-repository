import * as React from "react"
import { Label, Table } from "semantic-ui-react"

import CopyValue from "./CopyValue"
import { TruncateMiddle } from "../Utils/Format"

// Renderiza um valor técnico de forma legível: boolean como badge, número/string
// em monospace, path truncado no meio + copiar, objeto/array como JSON.
const RenderValue = (value:any) => {
    if(value === null || value === undefined)
        return <span style={{ color: "#bbb" }}>—</span>
    if(typeof value === "boolean")
        return <Label size="mini" basic color={value ? "green" : "grey"}>{String(value)}</Label>
    if(typeof value === "number")
        return <code>{value}</code>
    if(typeof value === "object")
        return <code style={{ whiteSpace: "pre-wrap", fontSize: ".85em" }}>{JSON.stringify(value, null, 2)}</code>

    const s = String(value)
    const isPath = s.startsWith("/") || s.startsWith("~") || s.includes("/")
    const display = (isPath || s.length > 52) ? TruncateMiddle(s, 52) : s
    return <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", maxWidth: "100%" }}>
        <code title={s} style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{display}</code>
        { s.length > 16 && <CopyValue value={s}/> }
    </span>
}

// Painel chave-valor compacto para dados técnicos (startup args, process info…).
const KeyValuePanel = ({ data }:any) => {
    const keys = Object.keys(data || {}).filter((k) => data[k] !== undefined && data[k] !== null && data[k] !== "")
    if(keys.length === 0)
        return <span style={{ color: "#bbb" }}>sem dados</span>
    return <Table basic="very" compact>
        <Table.Body>
            {
                keys.map((key:string, index:number) =>
                    <Table.Row key={index}>
                        <Table.Cell width={5} style={{ verticalAlign: "top" }}>
                            <strong style={{ fontFamily: "monospace", fontSize: ".88em", color: "#444" }}>{key}</strong>
                        </Table.Cell>
                        <Table.Cell>{RenderValue(data[key])}</Table.Cell>
                    </Table.Row>)
            }
        </Table.Body>
    </Table>
}

export default KeyValuePanel
