import * as React from "react"
import { useState } from "react"

import {
    Button,
    Icon,
    Label,
    Popup,
    Segment
} from "semantic-ui-react"

const SourceParamSummary = (source:any) => {
    const sp = source
    if(sp.sourceType === "LOCAL_FS")       return sp.path
    if(sp.sourceType === "GITHUB_RELEASE") return `${sp.repositoryOwner || ""}/${sp.repositoryName || ""}`
    if(sp.sourceType === "GOOGLE_DRIVE")   return sp.fileId
    return ""
}

// Lista acordeão por repositório (colapsada por padrão) para reduzir poluição.
// Cada namespace é uma linha-cabeçalho; expandida mostra suas fontes com ações
// em ícones discretos (install / set active / remove) + update no cabeçalho.
const SourcesListTable = ({
    groupedSources,
    getActiveSourceType,
    isInstalled,
    busyAction,
    onInstall,
    onChangeSource,
    onRemoveSource,
    onUpdate,
    onRegisterSourceForNamespace
}:any) => {

    const [ openMap, setOpenMap ] = useState<any>({})
    const toggle = (ns:string) => setOpenMap({ ...openMap, [ns]: !openMap[ns] })

    const isBusy = (ns:string, action:string, sourceType?:string) =>
        busyAction && busyAction.namespace === ns && busyAction.action === action
            && (sourceType === undefined || busyAction.sourceType === sourceType)

    return <div>
        {
            Object.keys(groupedSources).sort().map((ns:string, nsKey:number) => {
                const sources = groupedSources[ns]
                const installed = isInstalled(ns)
                const activeSourceType = getActiveSourceType(ns)
                const isOpen = openMap[ns]

                return <Segment key={nsKey} style={{ padding: 0, marginBottom: "8px" }}>
                    { /* cabeçalho do namespace */ }
                    <div
                        onClick={() => toggle(ns)}
                        style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px", cursor: "pointer" }}>
                        <Icon name={isOpen ? "caret down" : "caret right"} style={{ color: "#999" }}/>
                        <Icon name="cubes" style={{ color: "#7b8794" }}/>
                        <strong style={{ flex: 1 }}>{ns}</strong>
                        {
                            installed
                            ? <Label size="tiny" color="green" basic>installed · {activeSourceType}</Label>
                            : <Label size="tiny" basic>not installed</Label>
                        }
                        <span style={{ color: "#aaa", fontSize: ".85em" }}>{sources.length} src</span>
                        {
                            installed &&
                            <Button size="mini" basic icon title="update repository"
                                loading={isBusy(ns, "update")}
                                onClick={(e:any) => { e.stopPropagation(); onUpdate(ns) }}>
                                <Icon name="refresh"/>
                            </Button>
                        }
                    </div>

                    { /* fontes (expandido) */ }
                    {
                        isOpen && <div style={{ borderTop: "1px solid #eee" }}>
                            {
                                sources.length === 0 &&
                                <div style={{ padding: "8px 12px 8px 36px", color: "#bbb" }}>nenhuma fonte registrada</div>
                            }
                            {
                                sources.map((source:any, sKey:number) => {
                                    const isActive = installed && source.sourceType === activeSourceType
                                    return <div key={sKey}
                                        style={{ display: "flex", alignItems: "center", gap: "10px", padding: "7px 12px 7px 36px",
                                            background: isActive ? "#f4fbf5" : undefined, borderTop: sKey > 0 ? "1px solid #f3f3f3" : undefined }}>
                                        <Icon name={isActive ? "check circle" : "feed"} color={isActive ? "green" : "grey"}/>
                                        <span style={{ width: "120px", fontWeight: 500 }}>{source.sourceType}</span>
                                        <span style={{ flex: 1, color: "#888", fontFamily: "monospace", fontSize: ".82em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                                            title={SourceParamSummary(source)}>
                                            {SourceParamSummary(source)}
                                        </span>
                                        <Button.Group size="mini" basic>
                                            <Popup content="install" trigger={
                                                <Button icon loading={isBusy(ns, "install", source.sourceType)} onClick={() => onInstall(ns, source.sourceType)}>
                                                    <Icon name="download" color="blue"/>
                                                </Button>}/>
                                            {
                                                installed && !isActive &&
                                                <Popup content="set as active source" trigger={
                                                    <Button icon loading={isBusy(ns, "change", source.sourceType)} onClick={() => onChangeSource(ns, source.sourceType)}>
                                                        <Icon name="exchange"/>
                                                    </Button>}/>
                                            }
                                            <Popup content="remove source" trigger={
                                                <Button icon loading={isBusy(ns, "removeSource", source.sourceType)} onClick={() => onRemoveSource(ns, source.sourceType)}>
                                                    <Icon name="trash" color="red"/>
                                                </Button>}/>
                                        </Button.Group>
                                    </div>
                                })
                            }
                            <div style={{ padding: "6px 12px 8px 36px" }}>
                                <Button size="mini" basic compact onClick={() => onRegisterSourceForNamespace(ns)}>
                                    <Icon name="plus"/> add source
                                </Button>
                            </div>
                        </div>
                    }
                </Segment>
            })
        }
    </div>
}

export default SourcesListTable
