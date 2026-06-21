import * as React from "react"
import { useEffect, useRef, useState } from "react"
import { connect } from "react-redux"
import { Button, Icon, Label } from "semantic-ui-react"

import LogStreaming from "../Containers/InstanceSupervisor.container/LogStreaming"
import AppModal from "./AppModal"
import { subscribeLogWindows, expandLogWindow, minimizeLogWindow, closeLogWindow, getLogWindows, LogWindow } from "../Utils/logWindows"

const DOCK_HEIGHT = 46
const DEFAULT_WIDTH = 960   // largura padrão (dobro)
const MIN_WIDTH = 360

// Dock global de janelas de log: barra inferior (taskbar) com as janelas
// abertas. A expandida abre como offcanvas à direita. Janelas minimizadas
// continuam conectadas (preservam histórico) e indicam novas linhas não vistas.
const LogDock = ({ HTTPServerManager }:any) => {

    const [ windows, setWindows ] = useState<LogWindow[]>([])
    const [ unread, setUnread ]   = useState<any>({})
    const [ statusByWindow, setStatusByWindow ] = useState<any>({})
    const [ reconnectSignals, setReconnectSignals ] = useState<any>({})
    // largura por janela (lembrada mesmo minimizando, pois a janela fica montada)
    const [ widthByWindow, setWidthByWindow ] = useState<any>({})

    const _reconnect = (id:string) => setReconnectSignals((s:any) => ({ ...s, [id]: (s[id] || 0) + 1 }))

    // redimensiona a largura arrastando a borda esquerda do offcanvas
    const _startResize = (id:string, e:any) => {
        e.preventDefault(); e.stopPropagation()
        const onMove = (ev:any) => {
            const w = Math.min(Math.max(window.innerWidth - ev.clientX, MIN_WIDTH), window.innerWidth - 40)
            setWidthByWindow((prev:any) => ({ ...prev, [id]: w }))
        }
        const onUp = () => {
            document.removeEventListener("mousemove", onMove)
            document.removeEventListener("mouseup", onUp)
            document.body.style.userSelect = ""
        }
        document.body.style.userSelect = "none"
        document.addEventListener("mousemove", onMove)
        document.addEventListener("mouseup", onUp)
    }

    // Fechar perde o histórico → pede confirmação (minimizar/expandir/reconectar não pedem).
    const [ confirmCloseId, setConfirmCloseId ] = useState<string | undefined>()
    const _requestClose = (id:string) => setConfirmCloseId(id)
    const _confirmClose = () => { if(confirmCloseId) closeLogWindow(confirmCloseId); setConfirmCloseId(undefined) }
    const _closingName = confirmCloseId ? (getLogWindows().find((w) => w.id === confirmCloseId)?.socketName || "") : ""

    const windowsRef = useRef<LogWindow[]>([])
    windowsRef.current = windows

    useEffect(() => subscribeLogWindows(setWindows), [])

    // zera o "não visto" das janelas que estão expandidas
    useEffect(() => {
        setUnread((u:any) => {
            const next = { ...u }
            windows.forEach((w) => { if(!w.minimized) next[w.id] = 0 })
            return next
        })
    }, [windows])

    // avisa antes de atualizar/fechar a página enquanto há log stream aberto
    // (atualizar perde o histórico de todos os streams)
    useEffect(() => {
        const handler = (e:any) => {
            if(windows.length > 0){ e.preventDefault(); e.returnValue = "" }
        }
        window.addEventListener("beforeunload", handler)
        return () => window.removeEventListener("beforeunload", handler)
    }, [windows.length])

    // marca atividade só quando a janela está minimizada (não visível)
    const _markActivity = (id:string) => {
        const w = windowsRef.current.find((x) => x.id === id)
        if(w && w.minimized) setUnread((u:any) => ({ ...u, [id]: (u[id] || 0) + 1 }))
    }

    if(windows.length === 0) return null

    return <>
        {
            // todas as janelas montadas; só a expandida fica visível
            windows.map((w:LogWindow) =>
                <div key={w.id} style={{
                    position: "fixed", top: "52px", right: 0, bottom: `${DOCK_HEIGHT + 8}px`,
                    width: `${widthByWindow[w.id] || DEFAULT_WIDTH}px`, maxWidth: "96vw",
                    zIndex: 1500, background: "#fff", borderRadius: "8px 0 0 8px",
                    boxShadow: "-6px 0 22px rgba(16,24,40,.22)",
                    display: w.minimized ? "none" : "flex", flexDirection: "column"
                }}>
                    { /* alça de redimensionamento (borda esquerda) */ }
                    <div onMouseDown={(e) => _startResize(w.id, e)}
                        title="arrastar para redimensionar"
                        style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "7px", cursor: "ew-resize", zIndex: 2, background: "transparent", borderLeft: "2px solid transparent" }}
                        onMouseEnter={(e:any) => e.currentTarget.style.borderLeft = "2px solid #b6d3f2"}
                        onMouseLeave={(e:any) => e.currentTarget.style.borderLeft = "2px solid transparent"}/>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 12px", borderBottom: "1px solid #eef0f2", background: "#f6f7f9", borderRadius: "8px 0 0 0", flex: "0 0 auto" }}>
                        <Icon name="terminal" style={{ color: "#7b8794" }}/>
                        <strong style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={w.monitoringStateKey}>log · {w.socketName}</strong>
                        <Button size="mini" basic icon title="minimizar" onClick={() => minimizeLogWindow(w.id)}><Icon name="window minimize outline"/></Button>
                        <Icon name="close" link title="fechar (perde o histórico)" style={{ color: "#cfd3d7", marginLeft: "6px" }} onClick={() => _requestClose(w.id)}/>
                    </div>
                    <div style={{ flex: 1, minHeight: 0, display: "flex", padding: "10px 12px" }}>
                        <LogStreaming
                            monitoringStateKey={w.monitoringStateKey}
                            socketName={w.socketName}
                            HTTPServerManager={HTTPServerManager}
                            onActivity={() => _markActivity(w.id)}
                            onStatusChange={(s:string) => setStatusByWindow((m:any) => ({ ...m, [w.id]: s }))}
                            reconnectSignal={reconnectSignals[w.id] || 0}
                            visible={!w.minimized}
                            fill/>
                    </div>
                </div>)
        }

        { /* dock inferior (taskbar) — escuro + acento, para destacar do app */ }
        <div style={{
            position: "fixed", left: 0, right: 0, bottom: 0, height: `${DOCK_HEIGHT}px`, zIndex: 1490,
            display: "flex", alignItems: "center", gap: "10px", padding: "0 12px",
            background: "#222a35", borderTop: "3px solid #2f9e44", boxShadow: "0 -4px 16px rgba(16,24,40,.28)"
        }}>
            <span style={{ fontSize: ".72em", fontWeight: 700, textTransform: "uppercase", color: "#9aa6b2", letterSpacing: ".05em", flex: "0 0 auto" }}>
                <Icon name="terminal"/> log streams
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", overflowX: "auto" }}>
                {
                    windows.map((w:LogWindow) => {
                        const n = unread[w.id] || 0
                        const st = statusByWindow[w.id] || "connecting"
                        const dot:any = st === "open" ? "green" : (st === "connecting" ? "yellow" : "grey")
                        const disconnected = st === "closed"
                        return <div key={w.id}
                            title={`${w.socketName} · ${disconnected ? "desconectado" : st === "open" ? "conectado" : "conectando"}`}
                            onClick={() => (w.minimized ? expandLogWindow(w.id) : minimizeLogWindow(w.id))}
                            style={{
                                display: "flex", alignItems: "center", gap: "6px", padding: "4px 10px", borderRadius: "6px", cursor: "pointer", flex: "0 0 auto",
                                background: w.minimized ? "rgba(255,255,255,.08)" : "#3a6ea5",
                                border: w.minimized ? "1px solid rgba(255,255,255,.16)" : "1px solid #5a8fc7",
                                color: "#e6edf3",
                                fontWeight: w.minimized ? 400 : 600
                            }}>
                            <Icon name="circle" size="small" color={dot} className={st === "open" ? "eco-log-live" : undefined} style={{ flex: "0 0 auto" }}/>
                            <Icon name="terminal" style={{ color: w.minimized ? "#aeb6bf" : "#fff", flex: "0 0 auto" }}/>
                            <span style={{ maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: ".85em" }}>{w.socketName}</span>
                            { n > 0 && <Label color="red" circular size="mini" style={{ flex: "0 0 auto" }}>{n > 99 ? "99+" : n}</Label> }
                            {
                                disconnected &&
                                <Icon name="redo" title="reconectar" style={{ color: "#cfe0f2", flex: "0 0 auto" }} onClick={(e:any) => { e.stopPropagation(); _reconnect(w.id) }}/>
                            }
                            <Icon name="close" title="fechar (perde o histórico)" style={{ color: "rgba(255,255,255,.55)", flex: "0 0 auto", marginLeft: "2px" }} onClick={(e:any) => { e.stopPropagation(); _requestClose(w.id) }}/>
                        </div>
                    })
                }
            </div>
        </div>

        {
            confirmCloseId &&
            <AppModal
                variant="danger"
                open={true}
                header="Fechar log stream"
                confirmText="fechar"
                confirmIcon="close"
                onCancel={() => setConfirmCloseId(undefined)}
                onConfirm={_confirmClose}>
                Fechar o log stream de <strong>{_closingName}</strong>? Isso encerra a conexão e <strong>perde o histórico</strong> desta janela.
            </AppModal>
        }
    </>
}

const mapStateToProps = ({ HTTPServerManager }:any) => ({ HTTPServerManager })

export default connect(mapStateToProps)(LogDock)
