import * as React from "react"
import { useState, useEffect } from "react"
import { Button, Icon, Label, Loader, Segment } from "semantic-ui-react"

import GetAPI from "../Utils/GetAPI"
import CopyValue from "./CopyValue"
import StatusBadge from "./StatusBadge"

// Home = "Operations Overview": estado vivo do ecossistema (tiles de sistema com
// contadores + saúde), atalhos rápidos, sockets abertos e avisos. Substitui a
// antiga tela de boas-vindas estática. (§11.2 do guia)

const IGNORED_EXECUTABLES = ["execute-application", "execute-command-line-application", "execute-desktop-application"]
const IsIgnored = (name:string) => IGNORED_EXECUTABLES.includes((name || "").replace(/-dbg$/, ""))

const SocketName = (filePath:string) => {
    if(!filePath) return ""
    return (filePath.split("/").pop() || "").replace(/\.sock$/, "")
}

// Tile de sistema: ícone em bloco, contador grande, sub-status e navegação.
const SystemTile = ({ icon, title, count, sub, tone = "info", onClick }:any) => {
    const toneColor:any = {
        info:    "var(--mp-accent-blue)",
        success: "var(--mp-success)",
        warning: "var(--mp-warning)",
        neutral: "var(--mp-muted)"
    }
    return <button type="button" onClick={onClick} className="mp-tile">
        <span className="mp-tile__icon" style={{ borderColor: "var(--mp-line-strong)" }}>
            <Icon name={icon} style={{ margin: 0, color: toneColor[tone] }}/>
        </span>
        <span className="mp-tile__body">
            <span className="mp-tile__count">{count}</span>
            <span className="mp-tile__title">{title}</span>
            { sub && <span className="mp-tile__sub" style={{ color: toneColor[tone] }}>{sub}</span> }
        </span>
        <Icon name="arrow right" className="mp-tile__arrow"/>
    </button>
}

const PanelBox = ({ title, icon, action, children }:any) =>
    <div className="mp-ov-panel">
        <div className="mp-ov-panel__head">
            <span style={{ fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "8px" }}>
                <Icon name={icon} style={{ margin: 0, color: "var(--mp-ink-3)" }}/> {title}
            </span>
            { action }
        </div>
        <div className="mp-ov-panel__body">{ children }</div>
    </div>

const WelcomePanel = ({ onNavigate, ecosystemdataPath, serverManagerInformation }:any) => {

    const [ state, setState ] = useState<any>({ loading: true })

    const fetchAll = async () => {
        const api = (apiName:string) => GetAPI({ apiName, serverManagerInformation })
        const safe = (p:Promise<any>, fb:any) => p.then((r:any) => r.data).catch(() => fb)
        try {
            const [ overview, execs, envs, sources, defaults ] = await Promise.all([
                safe(api("InstancesSupervisor").Overview(), {}),
                safe(api("Executables").ListExecutables(), []),
                safe(api("Environments").ListEnvironments(), []),
                safe(api("Sources").ListSources(), []),
                safe(api("Configurations").GetDefaultEcosystemParameters(), {})
            ])
            setState({ loading: false, overview, execs, envs, sources, defaults })
        } catch(e) {
            setState({ loading: false, overview: {}, execs: [], envs: [], sources: [], defaults: {} })
        }
    }

    useEffect(() => { if(serverManagerInformation) fetchAll(); else setState({ loading: false }) }, [])

    if(state.loading) return <Segment style={{ margin: "15px" }}><Loader active inline="centered" style={{ margin: "40px" }}/></Segment>

    const overview = state.overview || {}
    const socketKeys = Object.keys(overview)
    const connected  = socketKeys.filter((k) => overview[k]?.status === "CONNECTED")
    const unavailable = socketKeys.filter((k) => overview[k]?.status !== "CONNECTED")

    const execs = (state.execs || []).filter((e:any) => !IsIgnored(e.executableName) && !e.isDebug)
    const installed = execs.filter((e:any) => e.isInstalled)
    const notInstalled = execs.filter((e:any) => !e.isInstalled)

    const envs = state.envs || []
    const repos = Array.from(new Set((state.sources || []).map((s:any) => s.repositoryNamespace).filter(Boolean)))
    const configCount = Object.keys(state.defaults || {}).length

    const allHealthy = unavailable.length === 0 && socketKeys.length > 0

    const tiles = [
        { icon: "server",   title: "Supervisor",   count: `${connected.length}/${socketKeys.length}`, sub: allHealthy ? "all connected" : `${unavailable.length} unavailable`, tone: allHealthy ? "success" : "warning", panel: "instance supervisor" },
        { icon: "terminal", title: "Executables",  count: execs.length, sub: `${installed.length} installed`, tone: "info", panel: "executables" },
        { icon: "sitemap",  title: "Environments", count: envs.length, sub: "generated environments", tone: "info", panel: "environments" },
        { icon: "cubes",    title: "Repositories", count: repos.length, sub: "repositories", tone: "info", panel: "repositories" },
        { icon: "cogs",     title: "Config",       count: configCount, sub: "default parameters", tone: "neutral", panel: "config files" }
    ]

    return <div style={{ padding: "6px 4px" }}>
        {/* header strip */}
        <div className="mp-ov-header">
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", minWidth: 0 }}>
                <Icon name="dashboard" size="big" style={{ margin: 0, color: "var(--mp-ink)" }}/>
                <div style={{ minWidth: 0 }}>
                    <div className="mp-ov-title">Operations Overview</div>
                    { ecosystemdataPath &&
                        <div style={{ marginTop: "4px" }}><CopyValue value={ecosystemdataPath}/> <code className="mp-mono" style={{ background: "transparent", border: "none" }}>{ecosystemdataPath}</code></div> }
                </div>
            </div>
            <Label size="large" color={allHealthy ? "green" : undefined} basic={!allHealthy}
                style={{ flex: "0 0 auto" }}>
                <Icon name={allHealthy ? "check circle" : "info circle"}/> { allHealthy ? "operational" : "ecosystem active" }
            </Label>
        </div>

        {/* system tiles */}
        <div className="mp-ov-tiles">
            { tiles.map((t:any, k:number) =>
                <SystemTile key={k} {...t} onClick={() => onNavigate({ panel: t.panel })}/>) }
        </div>

        {/* two-column: quick actions + open sockets | warnings */}
        <div className="mp-ov-grid">
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <PanelBox title="Quick actions" icon="bolt">
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <Button size="small" primary onClick={() => onNavigate({ panel: "executables" })}><Icon name="terminal"/> executables</Button>
                        <Button size="small" onClick={() => onNavigate({ panel: "instance supervisor" })}><Icon name="server"/> sockets</Button>
                        <Button size="small" onClick={() => onNavigate({ panel: "repositories" })}><Icon name="cubes"/> repositories</Button>
                        <Button size="small" basic onClick={() => onNavigate({ panel: "config files" })}><Icon name="cogs"/> config</Button>
                    </div>
                </PanelBox>

                <PanelBox title="Open sockets" icon="plug"
                    action={<Label circular size="small">{connected.length}</Label>}>
                    {
                        connected.length === 0
                        ? <div className="mp-ov-empty">no sockets connected right now.</div>
                        : connected.slice(0, 6).map((k:string) =>
                            <div key={k} className="mp-ov-row" onClick={() => onNavigate({ panel: "instance supervisor", params: { monitoringStateKey: k } })}>
                                <Icon name="plug" style={{ color: "var(--mp-success)", margin: 0, flex: "0 0 auto" }}/>
                                <strong style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{SocketName(overview[k].filePath)}</strong>
                                <StatusBadge status="CONNECTED" size="mini"/>
                                <Icon name="arrow right" style={{ color: "var(--mp-muted-2)", margin: 0, flex: "0 0 auto" }}/>
                            </div>)
                    }
                    { connected.length > 6 && <div className="mp-ov-more" onClick={() => onNavigate({ panel: "instance supervisor" })}>+{connected.length - 6} more…</div> }
                </PanelBox>
            </div>

            <PanelBox title="Warnings & pending" icon="warning circle">
                {
                    unavailable.length === 0 && notInstalled.length === 0
                    ? <div className="mp-ov-empty"><Icon name="check circle" style={{ color: "var(--mp-success)" }}/> nothing pending — all clear.</div>
                    : <>
                        {
                            unavailable.length > 0 &&
                            <div className="mp-ov-row" onClick={() => onNavigate({ panel: "instance supervisor" })}>
                                <Icon name="warning circle" style={{ color: "var(--mp-warning)", margin: 0, flex: "0 0 auto" }}/>
                                <span style={{ flex: 1 }}>{unavailable.length} supervisor socket(s) unavailable</span>
                                <Icon name="arrow right" style={{ color: "var(--mp-muted-2)", margin: 0 }}/>
                            </div>
                        }
                        {
                            notInstalled.length > 0 &&
                            <div className="mp-ov-row" onClick={() => onNavigate({ panel: "executables", params: { executableStatus: "not-installed" } })}>
                                <Icon name="download" style={{ color: "var(--mp-accent-blue)", margin: 0, flex: "0 0 auto" }}/>
                                <span style={{ flex: 1 }}>{notInstalled.length} executable(s) not installed</span>
                                <Icon name="arrow right" style={{ color: "var(--mp-muted-2)", margin: 0 }}/>
                            </div>
                        }
                    </>
                }
            </PanelBox>
        </div>
    </div>
}

export default WelcomePanel
