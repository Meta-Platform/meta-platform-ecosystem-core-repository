import * as React from "react"
import { useState, useEffect } from "react"
import {
    Button,
    CopyableMonoText,
    Icon,
    ListRow,
    PageMasthead,
    Panel,
    Spinner,
    StatusBadge,
    StatusChip,
    Tile,
    TileRow
} from "@i-components"

import GetAPI from "../Utils/GetAPI"

// Home = "Operations Overview": estado vivo do ecossistema (tiles de sistema com
// contadores + saúde), atalhos rápidos, sockets abertos e avisos. Substitui a
// antiga tela de boas-vindas estática. (§11.2 do guia)

const IGNORED_EXECUTABLES = ["execute-application", "execute-command-line-application", "execute-desktop-application"]
const IsIgnored = (name:string) => IGNORED_EXECUTABLES.includes((name || "").replace(/-dbg$/, ""))

const SocketName = (filePath:string) => {
    if(!filePath) return ""
    return (filePath.split("/").pop() || "").replace(/\.sock$/, "")
}

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

    if(state.loading) return <div className="ecp-home-loading"><Spinner label="loading overview…"/></div>

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

    return <div className="ecp-home">

        <PageMasthead
            icon="dashboard"
            title="Operations Overview"
            subtitle={ ecosystemdataPath ? <CopyableMonoText value={ecosystemdataPath} maxChars={96}/> : undefined }
            actions={
                <StatusChip
                    icon={allHealthy ? "check circle" : "info circle"}
                    label={allHealthy ? "operational" : "ecosystem active"}
                    tone={allHealthy ? "success" : "neutral"}/>
            }/>

        {/* system tiles */}
        <TileRow>
            {
                tiles.map((t:any, k:number) =>
                    <Tile
                        key={k}
                        icon={t.icon}
                        count={t.count}
                        title={t.title}
                        sub={<span className={`ecp-tile-sub ecp-tile-sub--${t.tone}`}>{t.sub}</span>}
                        onClick={() => onNavigate({ panel: t.panel })}/>)
            }
        </TileRow>

        {/* two-column: quick actions + open sockets | warnings */}
        <div className="mp-ov-grid">
            <div className="ecp-home-column">

                <Panel title="Quick actions" icon="bolt">
                    <div className="ecp-home-actions">
                        <Button size="sm" variant="primary" icon="terminal" onClick={() => onNavigate({ panel: "executables" })}>executables</Button>
                        <Button size="sm" icon="server" onClick={() => onNavigate({ panel: "instance supervisor" })}>sockets</Button>
                        <Button size="sm" icon="cubes" onClick={() => onNavigate({ panel: "repositories" })}>repositories</Button>
                        <Button size="sm" variant="subtle" icon="cogs" onClick={() => onNavigate({ panel: "config files" })}>config</Button>
                    </div>
                </Panel>

                <Panel
                    title="Open sockets"
                    icon="plug"
                    actions={<StatusChip label="connected" count={connected.length} tone={connected.length > 0 ? "success" : "neutral"}/>}>
                    {
                        connected.length === 0
                        ? <div className="mp-ov-empty">no sockets connected right now.</div>
                        : connected.slice(0, 6).map((k:string) =>
                            <ListRow
                                key={k}
                                icon="plug"
                                title={SocketName(overview[k].filePath)}
                                right={<>
                                    <StatusBadge status="CONNECTED" size="sm"/>
                                    <Icon name="arrow right" tone="muted"/>
                                </>}
                                onClick={() => onNavigate({ panel: "instance supervisor", params: { monitoringStateKey: k } })}/>)
                    }
                    {
                        connected.length > 6 &&
                        <div className="mp-ov-more" onClick={() => onNavigate({ panel: "instance supervisor" })}>+{connected.length - 6} more…</div>
                    }
                </Panel>
            </div>

            <Panel title="Warnings & pending" icon="warning circle">
                {
                    unavailable.length === 0 && notInstalled.length === 0
                    ? <div className="mp-ov-empty"><Icon name="check circle" tone="success"/> nothing pending — all clear.</div>
                    : <>
                        {
                            unavailable.length > 0 &&
                            <ListRow
                                icon="warning circle"
                                className="ecp-home-warning"
                                title={`${unavailable.length} supervisor socket(s) unavailable`}
                                right={<Icon name="arrow right" tone="muted"/>}
                                onClick={() => onNavigate({ panel: "instance supervisor" })}/>
                        }
                        {
                            notInstalled.length > 0 &&
                            <ListRow
                                icon="download"
                                className="ecp-home-info"
                                title={`${notInstalled.length} executable(s) not installed`}
                                right={<Icon name="arrow right" tone="muted"/>}
                                onClick={() => onNavigate({ panel: "executables", params: { executableStatus: "not-installed" } })}/>
                        }
                    </>
                }
            </Panel>
        </div>
    </div>
}

export default WelcomePanel
