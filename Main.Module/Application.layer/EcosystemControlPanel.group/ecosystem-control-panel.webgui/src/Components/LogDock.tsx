import * as React from "react"
import { useEffect, useRef, useState } from "react"
import { connect } from "react-redux"
import { ConfirmDialog, Icon } from "@i-components"

import LogStreaming from "../Containers/InstanceSupervisor.container/LogStreaming"
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
//
// Toda a pintura (terminal escuro, titlebar de runtime, acento do dock) sai de
// classes .ecp-logdock*/.ecp-logwin* em Styles/parts/shell.css, sobre os tokens
// --mp-terminal-* e --mp-titlebar-*. Aqui ficam só geometria e estado.
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
                className="ecp-logwin__handle"
                onMouseDown={(e) => _startResizeFloat(w, geo, h.dir, e)}
                style={{ cursor: h.cursor, ...h.style }}/>)
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
    const _dockTone =
        _statuses.some((s) => s === "closed")       ? "danger"
        : _statuses.some((s) => s === "connecting") ? "warning"
        : "success"

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

    // barra de título com os controles de modo. Controles como ícones claros
    // sobre a titlebar de runtime (--mp-titlebar-runtime).
    // (O vocabulário de status atual — connecting/open/closed — não distingue
    // sucesso de erro no fechamento, então não é usado para colorir a barra,
    // apenas o dock.)
    const _renderHeader = (w:LogWindow, draggable:boolean, base?:FloatGeometry) => {
        return <div
            onMouseDown={draggable && base ? (e:any) => _startDrag(w, base, e) : undefined}
            className={`ecp-logwin__titlebar ecp-logwin__titlebar--${w.mode === "offcanvas" ? "offcanvas" : "float"} ${draggable ? "is-draggable" : ""}`}>
            <Icon name="terminal"/>
            <strong className="ecp-logwin__name" title={w.monitoringStateKey}>
                runtime · {w.title}
            </strong>
            <span className="ecp-logwin__ctrls" onMouseDown={(e:any) => e.stopPropagation()}>
                {
                    w.mode !== "floating" &&
                    <button type="button" className="ecp-logwin__ctrl" title="floating window" aria-label="floating window" onClick={() => floatWindow(w.id)}>
                        <Icon name="clone outline"/>
                    </button>
                }
                {
                    w.mode !== "offcanvas" &&
                    <button type="button" className="ecp-logwin__ctrl" title="dock right" aria-label="dock right" onClick={() => dockRightWindow(w.id)}>
                        <Icon name="columns"/>
                    </button>
                }
                <button type="button" className="ecp-logwin__ctrl" title="minimize" aria-label="minimize" onClick={() => minimizeLogWindow(w.id)}>
                    <Icon name="window minimize outline"/>
                </button>
                <button type="button" className="ecp-logwin__ctrl is-quiet" title="close (loses history)" aria-label="close (loses history)" onClick={() => _requestClose(w.id)}>
                    <Icon name="close"/>
                </button>
            </span>
        </div>
    }

    return <>
        {
            windows.map((w:LogWindow) => {

                // OFFCANVAS (ancorado à direita) — e o modo MINIMIZADO reaproveita o
                // mesmo container escondido, para manter a janela montada.
                if(w.mode === "offcanvas" || w.mode === "minimized") {
                    return <div
                        key={w.id}
                        className="ecp-logwin ecp-logwin--offcanvas"
                        style={{
                            bottom: `${DOCK_HEIGHT + 8}px`,
                            width: `${widthByWindow[w.id] || DEFAULT_WIDTH}px`,
                            display: w.mode === "minimized" ? "none" : "flex"
                        }}>
                        <div
                            className="ecp-logwin__resize-x"
                            title="drag to resize width"
                            onMouseDown={(e) => _startResizeOffcanvas(w.id, e)}/>
                        { _renderHeader(w, false) }
                        <div className="ecp-logwin__body">
                            { _renderContent(w) }
                        </div>
                    </div>
                }

                // FLUTUANTE — arrastável/redimensionável, z-order por foco
                const geo:FloatGeometry = (liveGeo && liveGeo.id === w.id ? liveGeo.geo : w.float) || { x: 80, y: 90, width: 720, height: 420 }
                return <div
                    key={w.id}
                    className="ecp-logwin ecp-logwin--float"
                    onMouseDown={() => focusWindow(w.id)}
                    style={{
                        top: `${geo.y}px`,
                        left: `${geo.x}px`,
                        width: `${geo.width}px`,
                        height: `${geo.height}px`,
                        zIndex: floatZ(w.id)
                    }}>
                    { _renderHeader(w, true, geo) }
                    <div className="ecp-logwin__body">
                        { _renderContent(w) }
                    </div>
                    { /* alças de redimensionamento (todos os lados e cantos) */ }
                    { _renderResizeHandles(w, geo) }
                </div>
            })
        }

        { /* dock inferior (taskbar) — escuro + faixa de acento por estado */ }
        <div className={`ecp-logdock ecp-logdock--${_dockTone}`} style={{ height: `${DOCK_HEIGHT}px` }}>
            <span className="ecp-logdock__label">
                <Icon name="terminal" className="ecp-log-live"/> runtime streams
                <span className="ecp-logdock__count">{windows.length}</span>
            </span>
            <div className="ecp-logdock__tabs">
                {
                    windows.map((w:LogWindow) => {
                        const n = unread[w.id] || 0
                        const st = statusByWindow[w.id] || "connecting"
                        const dotTone:any = st === "open" ? "success" : (st === "connecting" ? "warning" : "muted")
                        const disconnected = st === "closed"
                        const active = w.mode !== "minimized"
                        return <div key={w.id}
                            className={`ecp-logdock__tab ${active ? "is-active" : ""}`}
                            title={`${w.title} · ${disconnected ? "disconnected" : st === "open" ? "connected" : "connecting"} · ${w.mode}`}
                            onClick={() => (w.mode === "minimized" ? expandLogWindow(w.id) : minimizeLogWindow(w.id))}>
                            <Icon name="circle" size="small" tone={dotTone} className={st === "open" ? "ecp-log-live" : undefined}/>
                            <Icon name="terminal"/>
                            <span className="ecp-logdock__tab-name">{w.title}</span>
                            { n > 0 && <span className="ecp-logdock__unread">{n > 99 ? "99+" : n}</span> }
                            {
                                disconnected &&
                                <button type="button" className="ecp-logdock__tab-btn" title="reconnect" aria-label="reconnect"
                                    onClick={(e:any) => { e.stopPropagation(); _reconnect(w.id) }}>
                                    <Icon name="redo"/>
                                </button>
                            }
                            <button type="button" className="ecp-logdock__tab-btn is-quiet" title="close (loses history)" aria-label="close (loses history)"
                                onClick={(e:any) => { e.stopPropagation(); _requestClose(w.id) }}>
                                <Icon name="close"/>
                            </button>
                        </div>
                    })
                }
            </div>
        </div>

        {
            confirmCloseId &&
            /* O diálogo do kit vive na camada --mp-z-modal, abaixo das janelas
               flutuantes de log (z-index ~1500). O invólucro cria um contexto de
               empilhamento acima delas para que a confirmação apareça na frente. */
            <div className="ecp-logdock__confirm-layer">
                <ConfirmDialog
                    open={true}
                    danger
                    title="Close runtime stream"
                    confirmLabel="close"
                    cancelLabel="cancel"
                    message={<>Close <strong>{_closingName}</strong>? This ends the connection and <strong>loses the history</strong> of this window.</>}
                    onCancel={() => setConfirmCloseId(undefined)}
                    onConfirm={_confirmClose}/>
            </div>
        }
    </>
}

const mapStateToProps = ({ HTTPServerManager }:any) => ({ HTTPServerManager })

export default connect(mapStateToProps)(LogDock)
