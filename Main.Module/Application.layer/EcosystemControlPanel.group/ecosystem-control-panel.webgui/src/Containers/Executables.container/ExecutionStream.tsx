import * as React from "react"
import { useEffect, useRef, useState } from "react"
import { Button, Checkbox, Icon, Label } from "semantic-ui-react"

import GetAPI from "../../Utils/GetAPI"

// Conteúdo "fill" do terminal de execução de um app, no mesmo formato do
// LogStreaming (para ser hospedado pelo LogDock em qualquer modo: minimizado,
// offcanvas ou flutuante). Reporta status ao dock via onStatusChange usando o
// vocabulário do dock ("open" | "connecting" | "closed").

const StripAnsi = (s:string) => s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "")

const ExtractExecutionMessage = (raw:any) => {
    try {
        const payload = typeof raw === "string" ? JSON.parse(raw) : raw
        return {
            type: payload.type || "stdout",
            message: payload.message || payload.data || payload.line || JSON.stringify(payload),
            status: payload.status
        }
    } catch(e) {
        return { type: "stdout", message: String(raw) }
    }
}

const ExecutionStream = ({ packageDirPath, executableName, serverManagerInformation, fill = false, visible = true, onActivity, onStatusChange, reconnectSignal }:any) => {

    const [ lines, setLines ]   = useState<any[]>([])
    const [ status, setStatus ] = useState<"connecting" | "running" | "closed">("connecting")
    const [ autoScroll, setAutoScroll ] = useState(true)
    const [ copyStatus, setCopyStatus ] = useState<"idle" | "copied" | "failed">("idle")

    const socketRef = useRef<WebSocket | null>(null)
    const bodyRef   = useRef<HTMLDivElement>(null)
    const autoRef   = useRef(true)
    autoRef.current = autoScroll
    const activityRef = useRef(onActivity)
    activityRef.current = onActivity

    const appendLine = (line:any) => {
        setLines((current) => {
            const splitLines = StripAnsi(line.message || "").split("\n").map((message) => ({ ...line, message }))
            const next = [ ...current, ...splitLines ]
            return next.length > 5000 ? next.slice(next.length - 5000) : next
        })
        activityRef.current && activityRef.current()
    }

    const disconnect = () => {
        const ws = socketRef.current
        socketRef.current = null
        if(ws) { ws.onmessage = null; ws.onclose = null; ws.onerror = null; try { ws.close() } catch(e) {} }
    }

    const connect = () => {
        disconnect()
        setStatus("connecting")
        setLines([])
        setCopyStatus("idle")
        try {
            const api = GetAPI({ apiName: "HostActions", serverManagerInformation })
            const ws = api.RunPackageStreaming({ encodedPackagePath: encodeURIComponent(packageDirPath) })
            socketRef.current = ws
            ws.onopen = () => setStatus("running")
            ws.onmessage = (event:any) => {
                const payload = ExtractExecutionMessage(event.data)
                if(payload.status === "running") setStatus("running")
                if(payload.status === "closed") setStatus("closed")
                appendLine(payload)
            }
            ws.onerror = () => appendLine({ type: "error", message: "[erro de conexão com terminal de execução]" })
            ws.onclose = () => setStatus("closed")
        } catch(e:any) {
            appendLine({ type: "error", message: `[falha ao abrir execução] ${e?.message || e}` })
            setStatus("closed")
        }
    }

    const handleStop = () => { disconnect(); setStatus("closed") }

    useEffect(() => {
        connect()
        return () => disconnect()
    }, [packageDirPath])

    useEffect(() => {
        if(autoRef.current && bodyRef.current)
            bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    }, [lines])

    useEffect(() => {
        if(visible && autoRef.current)
            requestAnimationFrame(() => { if(bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight })
    }, [visible])

    // reporta status ao dock no vocabulário dele (open/connecting/closed)
    useEffect(() => {
        if(!onStatusChange) return
        onStatusChange(status === "running" ? "open" : status === "connecting" ? "connecting" : "closed")
    }, [status])

    // "reconectar" acionado pelo dock = re-executar o app
    const firstSignalRef = useRef(true)
    useEffect(() => {
        if(firstSignalRef.current){ firstSignalRef.current = false; return }
        connect()
    }, [reconnectSignal])

    const statusMeta:any = {
        connecting: { color: "yellow", icon: "spinner",        text: "iniciando" },
        running:    { color: "orange", icon: "play",           text: "executando" },
        closed:     { color: "grey",   icon: "circle outline", text: "finalizado" }
    }
    const sm = statusMeta[status]
    const logText = lines.map((line:any) => line.message || "").join("\n")

    const copyLog = async () => {
        try {
            if(navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(logText)
            } else {
                const textarea = document.createElement("textarea")
                textarea.value = logText
                textarea.setAttribute("readonly", "true")
                textarea.style.position = "fixed"
                textarea.style.left = "-9999px"
                document.body.appendChild(textarea)
                textarea.select()
                document.execCommand("copy")
                document.body.removeChild(textarea)
            }
            setCopyStatus("copied")
            window.setTimeout(() => setCopyStatus("idle"), 1800)
        } catch(e) {
            setCopyStatus("failed")
            window.setTimeout(() => setCopyStatus("idle"), 2200)
        }
    }

    return <div style={fill ? { display: "flex", flexDirection: "column", height: "100%" } : undefined}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", flexWrap: "nowrap", flex: "0 0 auto", fontSize: ".9em", minWidth: 0 }}>
            <Label color={sm.color} size="small" style={{ flex: "0 0 auto" }}><Icon name={sm.icon} loading={status === "connecting"}/> {sm.text}</Label>
            <Label basic size="small" style={{ flex: "0 0 auto" }}><Icon name="list"/> {lines.length}</Label>
            <Checkbox toggle label="auto-scroll" checked={autoScroll} onChange={() => setAutoScroll(!autoScroll)} style={{ flex: "0 0 auto" }}/>
            <div style={{ marginLeft: "auto", display: "flex", gap: "6px", flex: "0 0 auto" }}>
                <Button size="mini" basic color={copyStatus === "failed" ? "red" : "orange"} icon title="copiar log" onClick={copyLog} disabled={lines.length === 0}>
                    <Icon name={copyStatus === "copied" ? "check" : copyStatus === "failed" ? "warning sign" : "copy"}/>
                </Button>
                {
                    status === "closed"
                    ? <Button size="mini" basic color="orange" icon labelPosition="left" onClick={connect}><Icon name="redo"/> reexecutar</Button>
                    : <Button size="mini" basic color="red" icon labelPosition="left" onClick={handleStop}><Icon name="stop"/> parar</Button>
                }
            </div>
        </div>
        <div
            ref={bodyRef}
            style={{
                background: "#111827", color: "#f8fafc", fontFamily: "monospace", fontSize: ".83em",
                lineHeight: 1.45, padding: "10px 12px", borderRadius: "6px",
                height: fill ? "auto" : "38vh", flex: fill ? 1 : undefined, minHeight: fill ? 0 : undefined,
                overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word",
                borderTop: "3px solid #f59f00",
                userSelect: "text", WebkitUserSelect: "text", cursor: "text"
            }}>
            {
                lines.length === 0
                ? <span style={{ color: "#9ca3af" }}>aguardando saída da execução…</span>
                : lines.map((line:any, key:number) =>
                    <div key={key} style={{ color: line.type === "stderr" || line.type === "error" ? "#fca5a5" : line.type === "status" ? "#fbbf24" : undefined }}>
                        {line.message || " "}
                    </div>)
            }
        </div>
    </div>
}

export default ExecutionStream
