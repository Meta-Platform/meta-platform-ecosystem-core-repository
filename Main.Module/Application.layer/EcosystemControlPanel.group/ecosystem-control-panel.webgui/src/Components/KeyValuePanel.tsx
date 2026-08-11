import * as React from "react"
import { Badge, KeyValueList } from "@i-components"

import CopyValue from "./CopyValue"
import { TruncateMiddle } from "../Utils/Format"

// Renderiza um valor técnico de forma legível e SEM vazar do container:
// boolean como badge, número/string em monospace, path truncado no meio +
// copiar, objeto/array como JSON com scroll contido.
const RenderValue = (value:any) => {
    if(value === null || value === undefined)
        return <span className="ecp-kv__empty">—</span>
    if(typeof value === "boolean")
        return <Badge className={`ecp-kv__bool ecp-kv__bool--${value ? "on" : "off"}`}>{String(value)}</Badge>
    if(typeof value === "number")
        return <span className="ecp-kv__number">{value}</span>
    if(typeof value === "object")
        return <span className="ecp-kv__json">{JSON.stringify(value, null, 2)}</span>

    const s = String(value)
    const isPath = s.startsWith("/") || s.startsWith("~") || s.includes("/")
    const display = (isPath || s.length > 60) ? TruncateMiddle(s, 60) : s
    return <span className="ecp-kv__text">
        <span title={s} className="ecp-kv__text-value">{display}</span>
        { s.length > 16 && <CopyValue value={s}/> }
    </span>
}

// Painel chave-valor compacto que respeita a largura do container (não vaza).
// `stacked` mantido por compatibilidade de API: o KeyValueList do kit já
// desenha o rótulo ACIMA do valor, que era exatamente o modo empilhado. A
// diferença passa a ser só a densidade (uma coluna x duas colunas).
const KeyValuePanel = ({ data, stacked = false }:any) => {
    const keys = Object.keys(data || {}).filter((k) => data[k] !== undefined && data[k] !== null && data[k] !== "")
    if(keys.length === 0)
        return <span className="ecp-kv__empty">sem dados</span>

    const items = keys.map((key:string) => ({
        label: key,
        value: RenderValue(data[key])
    }))

    return <KeyValueList
        className={`ecp-kv ${stacked ? "ecp-kv--stacked" : ""}`.trim()}
        columns={stacked ? 1 : 2}
        items={items}/>
}

export default KeyValuePanel
