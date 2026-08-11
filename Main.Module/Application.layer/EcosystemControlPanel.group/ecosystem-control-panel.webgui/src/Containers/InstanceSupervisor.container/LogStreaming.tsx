import * as React from "react"
import { useEffect, useRef, useState } from "react"

import {
    Button,
    CheckboxInput,
    CopyableMonoText,
    StatusChip,
    Toolbar
} from "@i-components"

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
        connecting: { tone: "warning", icon: "circle notch",   text: "connecting" },
        open:       { tone: "success", icon: "check circle",   text: "connected" },
        closed:     { tone: "neutral", icon: "circle outline", text: "disconnected" }
    }
    const sm = statusMeta[status]

    return <div className={`ecp-log-stream ${fill ? "is-fill" : ""}`.trim()}>
        <Toolbar className="ecp-fixed ecp-log-stream__bar">
            {/* StatusChip não aceita className — a animação (giro/pulso) fica no
                invólucro, que é meu, e nunca em cima de uma classe .mp-*. */}
            <span className={`ecp-log-status is-${status}`}>
                <StatusChip icon={sm.icon} tone={sm.tone} label={sm.text}/>
            </span>
            <CopyableMonoText value={monitoringStateKey} maxChars={16}/>
            <StatusChip icon="list" count={lines.length} label="lines"/>
            <CheckboxInput
                label="auto-scroll"
                checked={autoScroll}
                onChange={() => setAutoScroll(!autoScroll)}/>
            <Toolbar.Spacer/>
            {
                status === "open"
                ? <Button size="sm" variant="danger" icon="plug" onClick={handleDisconnect}>disconnect</Button>
                : <Button size="sm" icon="redo" onClick={connect}>reconnect</Button>
            }
        </Toolbar>
        <div ref={bodyRef} className={`ecp-log-terminal ${fill ? "is-fill" : ""}`.trim()}>
            {
                lines.length === 0
                ? <span className="ecp-log-terminal__waiting">waiting for process log…</span>
                : lines.map((line:string, key:number) => <div key={key}>{line || " "}</div>)
            }
        </div>
    </div>
}

export default LogStreaming
