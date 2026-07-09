import * as React from "react"
import { useEffect, useRef, useState } from "react"
import { connect } from "react-redux"
import { Button, Icon, Label } from "semantic-ui-react"

import LogStreaming from "../Containers/InstanceSupervisor.container/LogStreaming"
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

// Dock global de logs das instâncias supervisionadas. Cada janela pode estar
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
    // redimensiona por qualquer lado/canto: dir contém "n"/"s"/"e"/"w" combinados
    const _startResizeFloat = (w:LogWindow, base:FloatGeometry, dir:string, e:any) => {
        e.preventDefault(); e.stopPropagation()
        focusWindow(w.id)
        const startX = e.clientX, startY = e.clientY
        const compute = (ev:any):FloatGeometry => {
            const dx = ev.clientX - startX
            const dy = ev.clientY - startY
            let x = base.x, y = base.y, width = base.width, height = base.height
            if(dir.includes("e")) width  = base.width  + dx
            if(dir.includes("s")) height = base.height + dy
            if(dir.includes("w")) { width  = base.width  - dx; x = base.x + dx }
            if(dir.includes("n")) { height = base.height - dy; y = base.y + dy }
            if(width < MIN_FLOAT_W) {
                if(dir.includes("w")) x -= (MIN_FLOAT_W - width)
                width = MIN_FLOAT_W
            }
            if(height < MIN_FLOAT_H) {
                if(dir.includes("n")) y -= (MIN_FLOAT_H - height)
                height = MIN_FLOAT_H
            }
            x = clamp(x, 0, window.innerWidth  - 80)
            y = clamp(y, 52, window.innerHeight - 40)
            return { x, y, width, height }
        }
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

    // 8 alças de redimensionamento (bordas + cantos) da janela flutuante
    const _renderResizeHandles = (w:LogWindow, geo:FloatGeometry) => {
        const T = 7   // espessura das bordas
        const C = 14  // tamanho dos cantos
        const handles:any[] = [
            { dir: "n",  cursor: "ns-resize",   style: { top: 0, left: C, right: C, height: T } },
            { dir: "s",  cursor: "ns-resize",   style: { bottom: 0, left: C, right: C, height: T } },
            { dir: "w",  cursor: "ew-resize",   style: { left: 0, top: C, bottom: C, width: T } },
            { dir: "e",  cursor: "ew-resize",   style: { right: 0, top: C, bottom: C, width: T } },
            { dir: "nw", cursor: "nwse-resize", style: { top: 0, left: 0, width: C, height: C } },
            { dir: "se", cursor: "nwse-resize", style: { bottom: 0, right: 0, width: C, height: C } },
            { dir: "ne", cursor: "nesw-resize", style: { top: 0, right: 0, width: C, height: C } },
            { dir: "sw", cursor: "nesw-resize", style: { bottom: 0, left: 0, width: C, height: C } }
        ]
        return handles.map((h) =>
            <div key={h.dir}
                onMouseDown={(e) => _startResizeFloat(w, geo, h.dir, e)}
                style={{ position: "absolute", zIndex: 4, cursor: h.cursor, ...h.style }}/>)
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

    // estado agregado do dock: vermelho se alguma conexão caiu, atenção enquanto
    // conecta, verde quando todas estão abertas. Colore a faixa superior do dock.
    const _statuses = windows.map((w) => statusByWindow[w.id] || "connecting")
    const _dockAccent =
        _statuses.some((s) => s === "closed")     ? "var(--mp-danger)"
        : _statuses.some((s) => s === "connecting") ? "var(--mp-warning)"
        : "var(--mp-success)"

    const _renderContent = (w:LogWindow) =>
        <LogStreaming
            monitoringStateKey={w.monitoringStateKey}
            socketName={w.socketName}
            HTTPServerManager={HTTPServerManager}
            onActivity={() => _markActivity(w.id)}
            onStatusChange={(s:string) => setStatusByWindow((m:any) => ({ ...m, [w.id]: s }))}
            reconnectSignal={reconnectSignals[w.id] || 0}
            visible={w.mode !== "minimized"}
            fill/>

    // barra de título com os controles de modo. Controles como ícones brancos.
    // (O vocabulário de status atual — connecting/open/closed — não distingue
    // sucesso de erro no fechamento, então não é usado para colorir a barra,
    // apenas o dock.)
    const _renderHeader = (w:LogWindow, draggable:boolean, base?:FloatGeometry) => {
        return <div
            onMouseDown={draggable && base ? (e:any) => _startDrag(w, base, e) : undefined}
            style={{
                display: "flex", alignItems: "center", gap: "8px", padding: "7px 11px",
                background: "var(--mp-titlebar-runtime)", color: "#fff", fontSize: ".82em",
                borderBottom: "1px solid rgba(0,0,0,.20)",
                borderRadius: w.mode === "offcanvas" ? "8px 0 0 0" : "7px 7px 0 0",
                flex: "0 0 auto", cursor: draggable ? "move" : "default"
            }}>
            <Icon name="terminal" style={{ color: "#fff", opacity: .95, flex: "0 0 auto", margin: 0 }}/>
            <strong style={{ flex: 1, minWidth: 0, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={w.monitoringStateKey}>
                runtime · {w.title}
            </strong>
            <span onMouseDown={(e:any) => e.stopPropagation()} style={{ display: "inline-flex", alignItems: "center", gap: "13px", flex: "0 0 auto" }}>
                { w.mode !== "floating" && <Icon name="clone outline" link title="floating window" style={{ color: "#fff", margin: 0 }} onClick={() => floatWindow(w.id)}/> }
                { w.mode !== "offcanvas" && <Icon name="columns" link title="dock right" style={{ color: "#fff", margin: 0 }} onClick={() => dockRightWindow(w.id)}/> }
                <Icon name="window minimize outline" link title="minimize" style={{ color: "#fff", margin: 0 }} onClick={() => minimizeLogWindow(w.id)}/>
                <Icon name="close" link title="close (loses history)" style={{ color: "rgba(255,255,255,.85)", margin: 0 }} onClick={() => _requestClose(w.id)}/>
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
                        position: "fixed", top: "var(--mp-shell-topbar-h)", right: 0, bottom: `${DOCK_HEIGHT + 8}px`,
                        width: `${widthByWindow[w.id] || DEFAULT_WIDTH}px`, maxWidth: "96vw",
                        zIndex: 1500, background: "var(--mp-surface)", borderRadius: "8px 0 0 8px",
                        border: "2px solid var(--mp-line-strong)", borderRight: "none",
                        boxShadow: "-6px 0 22px rgba(16,24,40,.22)",
                        display: w.mode === "minimized" ? "none" : "flex", flexDirection: "column"
                    }}>
                        <div onMouseDown={(e) => _startResizeOffcanvas(w.id, e)}
                            title="drag to resize width"
                            style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "9px", cursor: "ew-resize", zIndex: 5, borderLeft: "3px solid var(--mp-line-soft)" }}
                            onMouseEnter={(e:any) => e.currentTarget.style.borderLeft = "3px solid var(--mp-accent-blue)"}
                            onMouseLeave={(e:any) => e.currentTarget.style.borderLeft = "3px solid var(--mp-line-soft)"}/>
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
                        zIndex: floatZ(w.id), background: "var(--mp-surface)", borderRadius: "var(--mp-radius-window)",
                        border: "var(--mp-border-strong)",
                        boxShadow: "0 20px 50px rgba(16,24,40,.46), 0 4px 14px rgba(16,24,40,.30)",
                        display: "flex", flexDirection: "column", overflow: "hidden"
                    }}>
                    { _renderHeader(w, true, geo) }
                    <div style={{ flex: 1, minHeight: 0, display: "flex", padding: "10px 12px" }}>
                        { _renderContent(w) }
                    </div>
                    { /* alças de redimensionamento (todos os lados e cantos) */ }
                    { _renderResizeHandles(w, geo) }
                </div>
            })
        }

        { /* dock inferior (taskbar) — escuro + faixa de acento verde forte + brilho */ }
        <div style={{
            position: "fixed", left: 0, right: 0, bottom: 0, height: `${DOCK_HEIGHT}px`, zIndex: 1490,
            display: "flex", alignItems: "center", gap: "10px", padding: "0 12px",
            background: "var(--mp-terminal-bg-2)",
            borderTop: `4px solid ${_dockAccent}`,
            boxShadow: "0 -8px 22px rgba(16,24,40,.40)"
        }}>
            <span style={{ fontSize: ".74em", fontWeight: 800, textTransform: "uppercase", color: _dockAccent, letterSpacing: ".06em", flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <Icon name="terminal" className="eco-log-live"/> runtime streams
                <Label circular size="mini" style={{ background: _dockAccent, color: "var(--mp-terminal-bg)", fontWeight: 800 }}>{windows.length}</Label>
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
                            title={`${w.title} · ${disconnected ? "disconnected" : st === "open" ? "connected" : "connecting"} · ${w.mode}`}
                            onClick={() => (w.mode === "minimized" ? expandLogWindow(w.id) : minimizeLogWindow(w.id))}
                            style={{
                                display: "flex", alignItems: "center", gap: "6px", padding: "4px 10px", borderRadius: "6px", cursor: "pointer", flex: "0 0 auto",
                                background: active ? "var(--mp-accent-blue)" : "rgba(255,255,255,.08)",
                                border: active ? "1px solid var(--mp-terminal-blue)" : "1px solid rgba(255,255,255,.16)",
                                color: "var(--mp-terminal-fg)", fontWeight: active ? 600 : 400
                            }}>
                            <Icon name="circle" size="small" color={dot} className={st === "open" ? "eco-log-live" : undefined} style={{ flex: "0 0 auto" }}/>
                            <Icon name="terminal" style={{ color: active ? "#fff" : "#aeb6bf", flex: "0 0 auto" }}/>
                            <span style={{ maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: ".85em" }}>{w.title}</span>
                            { n > 0 && <Label color="red" circular size="mini" style={{ flex: "0 0 auto" }}>{n > 99 ? "99+" : n}</Label> }
                            {
                                disconnected &&
                                <Icon name="redo" title="reconnect" style={{ color: "#cfe0f2", flex: "0 0 auto" }} onClick={(e:any) => { e.stopPropagation(); _reconnect(w.id) }}/>
                            }
                            <Icon name="close" title="close (loses history)" style={{ color: "rgba(255,255,255,.55)", flex: "0 0 auto", marginLeft: "2px" }} onClick={(e:any) => { e.stopPropagation(); _requestClose(w.id) }}/>
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
                header="Close runtime stream"
                confirmText="close"
                confirmIcon="close"
                onCancel={() => setConfirmCloseId(undefined)}
                onConfirm={_confirmClose}>
                Close <strong>{_closingName}</strong>? This ends the connection and <strong>loses the history</strong> of this window.
            </AppModal>
        }
    </>
}

const mapStateToProps = ({ HTTPServerManager }:any) => ({ HTTPServerManager })

export default connect(mapStateToProps)(LogDock)
