import * as React from "react"
import { useEffect, useRef, useState } from "react"
import { Button, Checkbox, Icon, Label } from "semantic-ui-react"

import GetAPI from "../../Utils/GetAPI"
import CopyValue from "../../Components/CopyValue"
import { ShortId } from "../../Utils/Format"

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
const LogStreaming = ({ monitoringStateKey, HTTPServerManager, fill = false, onActivity, onStatusChange, reconnectSignal, socketName, visible = true }:any) => {

    const [ lines, setLines ]       = useState<string[]>([])
    const [ status, setStatus ]     = useState<"connecting" | "open" | "closed">("connecting")
    const [ autoScroll, setAutoScroll ] = useState(true)

    const socketRef = useRef<WebSocket | null>(null)
    const bodyRef   = useRef<HTMLDivElement>(null)
    const autoRef   = useRef(true)
    autoRef.current = autoScroll
    const activityRef = useRef(onActivity)
    activityRef.current = onActivity

    const _append = (text:string) => {
        setLines((prev) => {
            const next = [...prev, ...StripAnsi(text).split("\n")]
            return next.length > 5000 ? next.slice(next.length - 5000) : next
        })
        activityRef.current && activityRef.current()
    }

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

    // cleanup do socket (sem mexer no status — usado em reconexão/unmount)
    const disconnect = () => {
        const ws = socketRef.current
        socketRef.current = null
        if(ws) { ws.onmessage = null; ws.onclose = null; ws.onerror = null; try { ws.close() } catch(e){} }
    }

    // desconexão manual (botão): encerra E marca como desconectado na UI/dock
    const handleDisconnect = () => {
        disconnect()
        setStatus("closed")
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

    // ao tornar-se visível (maximizar), rola para o último log se auto-scroll
    useEffect(() => {
        if(visible && autoRef.current)
            requestAnimationFrame(() => { if(bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight })
    }, [visible])

    // reporta o status de conexão para quem hospeda (ex.: dock)
    useEffect(() => { onStatusChange && onStatusChange(status) }, [status])

    // reconexão acionada externamente (botão do dock)
    const firstSignalRef = useRef(true)
    useEffect(() => {
        if(firstSignalRef.current){ firstSignalRef.current = false; return }
        connect()
    }, [reconnectSignal])

    const statusMeta:any = {
        connecting: { color: "yellow", icon: "spinner",      text: "conectando" },
        open:       { color: "green",  icon: "circle",       text: "conectado" },
        closed:     { color: "grey",   icon: "circle outline", text: "desconectado" }
    }
    const sm = statusMeta[status]

    return <div style={fill ? { display: "flex", flexDirection: "column", height: "100%" } : undefined}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px", flexWrap: "wrap", flex: "0 0 auto" }}>
            <Label color={sm.color} size="small" className={status === "open" ? "eco-pulse-color" : undefined}><Icon name={sm.icon} loading={status === "connecting"}/> {sm.text}</Label>
            { socketName && <span style={{ fontWeight: 600 }}><Icon name="plug" style={{ color: "#7b8794" }}/> {socketName}</span> }
            <span style={{ fontFamily: "monospace", fontSize: ".82em", color: "#8a9099" }} title={monitoringStateKey}>{ShortId(monitoringStateKey, 8, 6)}</span>
            <CopyValue value={monitoringStateKey}/>
            <Label basic size="small"><Icon name="list"/> {lines.length} linhas</Label>
            <Checkbox toggle label="auto-scroll" checked={autoScroll} onChange={() => setAutoScroll(!autoScroll)} style={{ marginLeft: "6px" }}/>
            <div style={{ marginLeft: "auto" }}>
                {
                    status === "open"
                    ? <Button size="mini" basic color="red" icon labelPosition="left" onClick={handleDisconnect}><Icon name="plug"/> desconectar</Button>
                    : <Button size="mini" basic color="blue" icon labelPosition="left" onClick={connect}><Icon name="redo"/> reconectar</Button>
                }
            </div>
        </div>
        <div
            ref={bodyRef}
            style={{
                background: "#1e2127", color: "#d7dbe0", fontFamily: "monospace", fontSize: ".82em",
                lineHeight: 1.45, padding: "10px 12px", borderRadius: "6px",
                height: fill ? "auto" : "62vh", flex: fill ? 1 : undefined, minHeight: fill ? 0 : undefined,
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
