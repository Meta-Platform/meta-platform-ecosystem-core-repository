import * as React from "react"
import { useEffect, useRef, useState } from "react"
import { connect } from "react-redux"
import { Button, Icon, Label } from "semantic-ui-react"

import LogStreaming from "../Containers/InstanceSupervisor.container/LogStreaming"
import ExecutionStream from "../Containers/Executables.container/ExecutionStream"
import AppModal from "./AppModal"
import {
    subscribeLogWindows, expandLogWindow, minimizeLogWindow, floatWindow, dockRightWindow,
    closeLogWindow, getLogWindows, focusWindow, updateFloatGeometry, LogWindow, FloatGeometry
} from "../Utils/logWindows"

const DOCK_HEIGHT = 50
const DEFAULT_WIDTH = 960   // largura padrão do offcanvas
const MIN_WIDTH = 360
const MIN_FLOAT_W = 380
const MIN_FLOAT_H = 220

const clamp = (v:number, lo:number, hi:number) => Math.min(Math.max(v, lo), hi)

// Dock global de runtime: logs e terminais de execução. Cada janela pode estar
// minimizada (dock inferior), ancorada à direita (offcanvas) ou flutuante
// (arrastável). Todas ficam montadas — trocar de modo nunca perde a conexão.
const LogDock = ({ HTTPServerManager }:any) => {

    const [ windows, setWindows ] = useState<LogWindow[]>([])
    const [ unread, setUnread ]   = useState<any>({})
    const [ statusByWindow, setStatusByWindow ] = useState<any>({})
    const [ reconnectSignals, setReconnectSignals ] = useState<any>({})
    // largura do offcanvas por janela (lembrada mesmo minimizando)
    const [ widthByWindow, setWidthByWindow ] = useState<any>({})
    // geometria "ao vivo" durante arrastar/redimensionar uma flutuante
    const [ liveGeo, setLiveGeo ] = useState<{ id:string, geo:FloatGeometry } | null>(null)

    const _reconnect = (id:string) => setReconnectSignals((s:any) => ({ ...s, [id]: (s[id] || 0) + 1 }))

    // --- resize do offcanvas (arrastando a borda esquerda) ---
    const _startResizeOffcanvas = (id:string, e:any) => {
        e.preventDefault(); e.stopPropagation()
        const onMove = (ev:any) => {
            const w = clamp(window.innerWidth - ev.clientX, MIN_WIDTH, window.innerWidth - 40)
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

    // --- arrastar uma flutuante (pelo header) ---
    const _startDrag = (w:LogWindow, base:FloatGeometry, e:any) => {
        if(e.button !== 0) return
        e.preventDefault()
        focusWindow(w.id)
        const startX = e.clientX, startY = e.clientY
        const compute = (ev:any):FloatGeometry => ({
            ...base,
            x: clamp(base.x + (ev.clientX - startX), 0, window.innerWidth - 80),
            y: clamp(base.y + (ev.clientY - startY), 52, window.innerHeight - 40)
        })
        const onMove = (ev:any) => setLiveGeo({ id: w.id, geo: compute(ev) })
        const onUp = (ev:any) => {
            document.removeEventListener("mousemove", onMove)
            document.removeEventListener("mouseup", onUp)
            document.body.style.userSelect = ""
            updateFloatGeometry(w.id, compute(ev))
            setLiveGeo(null)
        }
        document.body.style.userSelect = "none"
        document.addEventListener("mousemove", onMove)
        document.addEventListener("mouseup", onUp)
    }

    // --- redimensionar uma flutuante (canto inferior direito) ---
    const _startResizeFloat = (w:LogWindow, base:FloatGeometry, e:any) => {
        e.preventDefault(); e.stopPropagation()
        focusWindow(w.id)
        const startX = e.clientX, startY = e.clientY
        const compute = (ev:any):FloatGeometry => ({
            ...base,
            width:  clamp(base.width  + (ev.clientX - startX), MIN_FLOAT_W, window.innerWidth  - base.x - 10),
            height: clamp(base.height + (ev.clientY - startY), MIN_FLOAT_H, window.innerHeight - base.y - 10)
        })
        const onMove = (ev:any) => setLiveGeo({ id: w.id, geo: compute(ev) })
        const onUp = (ev:any) => {
            document.removeEventListener("mousemove", onMove)
            document.removeEventListener("mouseup", onUp)
            document.body.style.userSelect = ""
            updateFloatGeometry(w.id, compute(ev))
            setLiveGeo(null)
        }
        document.body.style.userSelect = "none"
        document.addEventListener("mousemove", onMove)
        document.addEventListener("mouseup", onUp)
    }

    // Fechar perde o histórico → confirma (minimizar/flutuar/reconectar não pedem).
    const [ confirmCloseId, setConfirmCloseId ] = useState<string | undefined>()
    const _requestClose = (id:string) => setConfirmCloseId(id)
    const _confirmClose = () => { if(confirmCloseId) closeLogWindow(confirmCloseId); setConfirmCloseId(undefined) }
    const _closingName = confirmCloseId ? (getLogWindows().find((w) => w.id === confirmCloseId)?.title || "") : ""

    const windowsRef = useRef<LogWindow[]>([])
    windowsRef.current = windows

    useEffect(() => subscribeLogWindows(setWindows), [])

    // zera o "não visto" das janelas visíveis (não minimizadas)
    useEffect(() => {
        setUnread((u:any) => {
            const next = { ...u }
            windows.forEach((w) => { if(w.mode !== "minimized") next[w.id] = 0 })
            return next
        })
    }, [windows])

    // avisa antes de recarregar/fechar a página enquanto há stream aberto
    useEffect(() => {
        const handler = (e:any) => { if(windows.length > 0){ e.preventDefault(); e.returnValue = "" } }
        window.addEventListener("beforeunload", handler)
        return () => window.removeEventListener("beforeunload", handler)
    }, [windows.length])

    // atividade só conta quando a janela está minimizada (não visível)
    const _markActivity = (id:string) => {
        const w = windowsRef.current.find((x) => x.id === id)
        if(w && w.mode === "minimized") setUnread((u:any) => ({ ...u, [id]: (u[id] || 0) + 1 }))
    }

    if(windows.length === 0) return null

    // z-order das flutuantes (foco por clique)
    const floatingSorted = windows.filter((w) => w.mode === "floating").sort((a, b) => a.z - b.z)
    const floatZ = (id:string) => 1501 + Math.max(0, floatingSorted.findIndex((w) => w.id === id))

    const _renderContent = (w:LogWindow) =>
        w.kind === "exec"
            ? <ExecutionStream
                packageDirPath={w.packageDirPath}
                executableName={w.executableName}
                serverManagerInformation={HTTPServerManager}
                onActivity={() => _markActivity(w.id)}
                onStatusChange={(s:string) => setStatusByWindow((m:any) => ({ ...m, [w.id]: s }))}
                reconnectSignal={reconnectSignals[w.id] || 0}
                visible={w.mode !== "minimized"}
                fill/>
            : <LogStreaming
                monitoringStateKey={w.monitoringStateKey}
                socketName={w.socketName}
                HTTPServerManager={HTTPServerManager}
                onActivity={() => _markActivity(w.id)}
                onStatusChange={(s:string) => setStatusByWindow((m:any) => ({ ...m, [w.id]: s }))}
                reconnectSignal={reconnectSignals[w.id] || 0}
                visible={w.mode !== "minimized"}
                fill/>

    // barra de título com os controles de modo — colorida por tipo, para
    // destacar a janela do restante da tela. Controles como ícones brancos.
    const _renderHeader = (w:LogWindow, draggable:boolean, base?:FloatGeometry) => {
        const headerBg = w.kind === "exec" ? "#b5651d" : "#34567d"
        return <div
            onMouseDown={draggable && base ? (e:any) => _startDrag(w, base, e) : undefined}
            style={{
                display: "flex", alignItems: "center", gap: "8px", padding: "7px 11px",
                background: headerBg, color: "#fff", fontSize: ".82em",
                borderBottom: "1px solid rgba(0,0,0,.20)",
                borderRadius: w.mode === "offcanvas" ? "8px 0 0 0" : "7px 7px 0 0",
                flex: "0 0 auto", cursor: draggable ? "move" : "default"
            }}>
            <Icon name={w.kind === "exec" ? "play" : "terminal"} style={{ color: "#fff", opacity: .95, flex: "0 0 auto", margin: 0 }}/>
            <strong style={{ flex: 1, minWidth: 0, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={w.monitoringStateKey || w.executableName}>
                { w.kind === "exec" ? "execução" : "runtime" } · {w.title}
            </strong>
            <span onMouseDown={(e:any) => e.stopPropagation()} style={{ display: "inline-flex", alignItems: "center", gap: "13px", flex: "0 0 auto" }}>
                { w.mode !== "floating" && <Icon name="clone outline" link title="janela flutuante" style={{ color: "#fff", margin: 0 }} onClick={() => floatWindow(w.id)}/> }
                { w.mode !== "offcanvas" && <Icon name="columns" link title="ancorar à direita" style={{ color: "#fff", margin: 0 }} onClick={() => dockRightWindow(w.id)}/> }
                <Icon name="window minimize outline" link title="minimizar" style={{ color: "#fff", margin: 0 }} onClick={() => minimizeLogWindow(w.id)}/>
                <Icon name="close" link title="fechar (perde o histórico)" style={{ color: "rgba(255,255,255,.85)", margin: 0 }} onClick={() => _requestClose(w.id)}/>
            </span>
        </div>
    }

    return <>
        {
            windows.map((w:LogWindow) => {

                // OFFCANVAS (ancorado à direita) — e o modo MINIMIZADO reaproveita o
                // mesmo container escondido, para manter a janela montada.
                if(w.mode === "offcanvas" || w.mode === "minimized") {
                    return <div key={w.id} style={{
                        position: "fixed", top: "52px", right: 0, bottom: `${DOCK_HEIGHT + 8}px`,
                        width: `${widthByWindow[w.id] || DEFAULT_WIDTH}px`, maxWidth: "96vw",
                        zIndex: 1500, background: "#fff", borderRadius: "8px 0 0 8px",
                        boxShadow: "-6px 0 22px rgba(16,24,40,.22)",
                        display: w.mode === "minimized" ? "none" : "flex", flexDirection: "column"
                    }}>
                        <div onMouseDown={(e) => _startResizeOffcanvas(w.id, e)}
                            title="arrastar para redimensionar"
                            style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "7px", cursor: "ew-resize", zIndex: 2, borderLeft: "2px solid transparent" }}
                            onMouseEnter={(e:any) => e.currentTarget.style.borderLeft = "2px solid #b6d3f2"}
                            onMouseLeave={(e:any) => e.currentTarget.style.borderLeft = "2px solid transparent"}/>
                        { _renderHeader(w, false) }
                        <div style={{ flex: 1, minHeight: 0, display: "flex", padding: "10px 12px" }}>
                            { _renderContent(w) }
                        </div>
                    </div>
                }

                // FLUTUANTE — arrastável/redimensionável, z-order por foco
                const geo:FloatGeometry = (liveGeo && liveGeo.id === w.id ? liveGeo.geo : w.float) || { x: 80, y: 90, width: 720, height: 420 }
                return <div key={w.id}
                    onMouseDown={() => focusWindow(w.id)}
                    style={{
                        position: "fixed", top: `${geo.y}px`, left: `${geo.x}px`,
                        width: `${geo.width}px`, height: `${geo.height}px`,
                        zIndex: floatZ(w.id), background: "#fff", borderRadius: "9px",
                        border: "2px solid #8f99a6",
                        boxShadow: "0 20px 50px rgba(16,24,40,.46), 0 4px 14px rgba(16,24,40,.30)",
                        display: "flex", flexDirection: "column", overflow: "hidden"
                    }}>
                    { _renderHeader(w, true, geo) }
                    <div style={{ flex: 1, minHeight: 0, display: "flex", padding: "10px 12px" }}>
                        { _renderContent(w) }
                    </div>
                    { /* alça de redimensionamento (canto inferior direito) */ }
                    <div onMouseDown={(e) => _startResizeFloat(w, geo, e)}
                        title="arrastar para redimensionar"
                        style={{ position: "absolute", right: 0, bottom: 0, width: "16px", height: "16px", cursor: "nwse-resize", zIndex: 3 }}>
                        <Icon name="expand" style={{ fontSize: ".7em", color: "#adb5bd", position: "absolute", right: "1px", bottom: "0" }}/>
                    </div>
                </div>
            })
        }

        { /* dock inferior (taskbar) — escuro + faixa de acento verde forte + brilho */ }
        <div style={{
            position: "fixed", left: 0, right: 0, bottom: 0, height: `${DOCK_HEIGHT}px`, zIndex: 1490,
            display: "flex", alignItems: "center", gap: "10px", padding: "0 12px",
            background: "#1f2937",
            borderTop: "4px solid #37b24d",
            boxShadow: "0 -2px 0 rgba(55,178,77,.45), 0 -8px 22px rgba(16,24,40,.40)"
        }}>
            <span style={{ fontSize: ".74em", fontWeight: 800, textTransform: "uppercase", color: "#37b24d", letterSpacing: ".06em", flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <Icon name="terminal" className="eco-log-live"/> runtime streams
                <Label circular size="mini" style={{ background: "#37b24d", color: "#0b1f12", fontWeight: 800 }}>{windows.length}</Label>
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", overflowX: "auto" }}>
                {
                    windows.map((w:LogWindow) => {
                        const n = unread[w.id] || 0
                        const st = statusByWindow[w.id] || "connecting"
                        const dot:any = st === "open" ? "green" : (st === "connecting" ? "yellow" : "grey")
                        const disconnected = st === "closed"
                        const active = w.mode !== "minimized"
                        return <div key={w.id}
                            title={`${w.title} · ${disconnected ? "desconectado" : st === "open" ? "conectado" : "conectando"} · ${w.mode}`}
                            onClick={() => (w.mode === "minimized" ? expandLogWindow(w.id) : minimizeLogWindow(w.id))}
                            style={{
                                display: "flex", alignItems: "center", gap: "6px", padding: "4px 10px", borderRadius: "6px", cursor: "pointer", flex: "0 0 auto",
                                background: active ? "#3a6ea5" : "rgba(255,255,255,.08)",
                                border: active ? "1px solid #5a8fc7" : "1px solid rgba(255,255,255,.16)",
                                color: "#e6edf3", fontWeight: active ? 600 : 400
                            }}>
                            <Icon name="circle" size="small" color={dot} className={st === "open" ? "eco-log-live" : undefined} style={{ flex: "0 0 auto" }}/>
                            <Icon name={w.kind === "exec" ? "play" : "terminal"} style={{ color: active ? "#fff" : "#aeb6bf", flex: "0 0 auto" }}/>
                            <span style={{ maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: ".85em" }}>{w.title}</span>
                            { n > 0 && <Label color="red" circular size="mini" style={{ flex: "0 0 auto" }}>{n > 99 ? "99+" : n}</Label> }
                            {
                                disconnected &&
                                <Icon name="redo" title="reconectar / re-executar" style={{ color: "#cfe0f2", flex: "0 0 auto" }} onClick={(e:any) => { e.stopPropagation(); _reconnect(w.id) }}/>
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
                header="Fechar runtime stream"
                confirmText="fechar"
                confirmIcon="close"
                onCancel={() => setConfirmCloseId(undefined)}
                onConfirm={_confirmClose}>
                Fechar <strong>{_closingName}</strong>? Isso encerra a conexão e <strong>perde o histórico</strong> desta janela.
            </AppModal>
        }
    </>
}

const mapStateToProps = ({ HTTPServerManager }:any) => ({ HTTPServerManager })

export default connect(mapStateToProps)(LogDock)
