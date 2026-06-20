import * as React from "react"
import { useEffect, useRef, useState } from "react"
import { Button, Checkbox, Icon, Label } from "semantic-ui-react"

import GetAPI from "../../Utils/GetAPI"

// Remove sequências ANSI (cores/escape) já que é um visualizador de texto puro.
const StripAnsi = (s:string) => s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "")

const ExtractMessage = (raw:any):string => {
    try {
        const o = JSON.parse(raw)
        if(typeof o === "string") return o
        return o.message ?? o.log ?? o.data ?? o.line ?? JSON.stringify(o)
    } catch(e) {
        return String(raw)
    }
}

// Visualizador de log do processo via socket: abre o WebSocket LogStreaming do
// supervisor (que repassa o LogStreaming do package-executor) e mostra as linhas
// num terminal escuro com auto-scroll.
const LogStreaming = ({ monitoringStateKey, HTTPServerManager }:any) => {

    const [ lines, setLines ]       = useState<string[]>([])
    const [ status, setStatus ]     = useState<"connecting" | "open" | "closed">("connecting")
    const [ autoScroll, setAutoScroll ] = useState(true)

    const socketRef = useRef<WebSocket | null>(null)
    const bodyRef   = useRef<HTMLDivElement>(null)
    const autoRef   = useRef(true)
    autoRef.current = autoScroll

    const _append = (text:string) =>
        setLines((prev) => {
            const next = [...prev, ...StripAnsi(text).split("\n")]
            return next.length > 5000 ? next.slice(next.length - 5000) : next
        })

    const connect = () => {
        disconnect()
        setStatus("connecting")
        try {
            const api = GetAPI({ apiName: "InstancesSupervisor", serverManagerInformation: HTTPServerManager })
            const ws:WebSocket = api.LogStreaming({ monitoringStateKey })
            socketRef.current = ws
            ws.onopen    = () => setStatus("open")
            ws.onmessage = (ev:any) => _append(ExtractMessage(ev.data))
            ws.onerror   = () => _append("[erro de conexão com o socket de log]")
            ws.onclose   = () => setStatus("closed")
        } catch(e:any) {
            _append(`[falha ao abrir o stream] ${e?.message || e}`)
            setStatus("closed")
        }
    }

    const disconnect = () => {
        const ws = socketRef.current
        socketRef.current = null
        if(ws) { ws.onmessage = null; ws.onclose = null; try { ws.close() } catch(e){} }
    }

    // Ao trocar de socket/instância: limpa o terminal e reconecta no novo log
    // (mantém a aba "logs" ativa, só troca o conteúdo do terminal).
    useEffect(() => {
        setLines([])
        connect()
        return () => disconnect()
    }, [monitoringStateKey])

    useEffect(() => {
        if(autoRef.current && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    }, [lines])

    const statusMeta:any = {
        connecting: { color: "yellow", icon: "spinner",      text: "conectando" },
        open:       { color: "green",  icon: "circle",       text: "conectado" },
        closed:     { color: "grey",   icon: "circle outline", text: "desconectado" }
    }
    const sm = statusMeta[status]

    return <div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px", flexWrap: "wrap" }}>
            <Label color={sm.color} size="small"><Icon name={sm.icon} loading={status === "connecting"}/> {sm.text}</Label>
            <Label basic size="small">{lines.length} linhas</Label>
            <Checkbox toggle label="auto-scroll" checked={autoScroll} onChange={() => setAutoScroll(!autoScroll)} style={{ marginLeft: "6px" }}/>
            <div style={{ marginLeft: "auto", display: "flex", gap: "6px" }}>
                <Button size="mini" basic icon labelPosition="left" onClick={() => setLines([])}><Icon name="erase"/> limpar</Button>
                {
                    status === "open"
                    ? <Button size="mini" basic color="red" icon labelPosition="left" onClick={disconnect}><Icon name="stop"/> parar</Button>
                    : <Button size="mini" basic color="blue" icon labelPosition="left" onClick={connect}><Icon name="plug"/> reconectar</Button>
                }
            </div>
        </div>
        <div
            ref={bodyRef}
            style={{
                background: "#1e2127", color: "#d7dbe0", fontFamily: "monospace", fontSize: ".82em",
                lineHeight: 1.45, padding: "10px 12px", borderRadius: "6px", height: "62vh",
                overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word"
            }}>
            {
                lines.length === 0
                ? <span style={{ color: "#6b7177" }}>aguardando log do processo…</span>
                : lines.map((line:string, key:number) => <div key={key}>{line || " "}</div>)
            }
        </div>
    </div>
}

export default LogStreaming
