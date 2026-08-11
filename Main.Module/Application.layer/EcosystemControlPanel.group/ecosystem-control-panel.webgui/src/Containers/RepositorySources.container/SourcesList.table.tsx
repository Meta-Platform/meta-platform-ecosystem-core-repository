import * as React from "react"
import { useState } from "react"

import {
    Button,
    CopyableMonoText,
    Icon,
    StatusChip
} from "@i-components"

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

    return <div className="ecp-sources-list">
        {
            Object.keys(groupedSources).sort().map((ns:string, nsKey:number) => {
                const sources = groupedSources[ns]
                const installed = isInstalled(ns)
                const activeSourceType = getActiveSourceType(ns)
                const isOpen = openMap[ns]

                return <section key={nsKey} className="ecp-ns-block">
                    { /* cabeçalho do namespace (acordeão) */ }
                    <div className="ecp-ns-block__head">
                        <button
                            type="button"
                            className="ecp-ns-block__toggle"
                            aria-expanded={Boolean(isOpen)}
                            onClick={() => toggle(ns)}>
                            <Icon name={isOpen ? "caret down" : "caret right"} tone="muted"/>
                            <Icon name="cubes" tone="muted"/>
                            <strong className="ecp-ns-block__name">{ns}</strong>
                            {
                                installed
                                ? <StatusChip tone="success" label={`installed · ${activeSourceType}`}/>
                                : <StatusChip label="not installed"/>
                            }
                            <span className="ecp-ns-block__count">{sources.length} src</span>
                        </button>
                        {
                            installed &&
                            <Button
                                variant="subtle"
                                size="sm"
                                icon="refresh"
                                title="update repository"
                                aria-label="update repository"
                                loading={isBusy(ns, "update")}
                                onClick={(e:any) => { e.stopPropagation(); onUpdate(ns) }}/>
                        }
                    </div>

                    { /* fontes (expandido) */ }
                    {
                        isOpen && <div className="ecp-ns-block__body">
                            {
                                sources.length === 0 &&
                                <div className="ecp-ns-block__empty">no sources registered</div>
                            }
                            {
                                sources.map((source:any, sKey:number) => {
                                    const isActive = installed && source.sourceType === activeSourceType
                                    return <div key={sKey} className={`ecp-source-row ${isActive ? "is-active" : ""}`.trim()}>
                                        <Icon
                                            name={isActive ? "check circle" : "feed"}
                                            tone={isActive ? "success" : "muted"}/>
                                        <span className="ecp-source-row__type">{source.sourceType}</span>
                                        <span className="ecp-source-row__summary">
                                            <CopyableMonoText value={SourceParamSummary(source) || ""} maxChars={52}/>
                                        </span>
                                        <span className="ecp-source-row__actions">
                                            <Button
                                                variant="subtle"
                                                size="sm"
                                                icon="download"
                                                title="install"
                                                aria-label="install"
                                                loading={isBusy(ns, "install", source.sourceType)}
                                                onClick={() => onInstall(ns, source.sourceType)}/>
                                            {
                                                installed && !isActive &&
                                                <Button
                                                    variant="subtle"
                                                    size="sm"
                                                    icon="exchange"
                                                    title="set as active source"
                                                    aria-label="set as active source"
                                                    loading={isBusy(ns, "change", source.sourceType)}
                                                    onClick={() => onChangeSource(ns, source.sourceType)}/>
                                            }
                                            <Button
                                                variant="danger"
                                                size="sm"
                                                icon="trash"
                                                title="remove source"
                                                aria-label="remove source"
                                                loading={isBusy(ns, "removeSource", source.sourceType)}
                                                onClick={() => onRemoveSource(ns, source.sourceType)}/>
                                        </span>
                                    </div>
                                })
                            }
                            <div className="ecp-ns-block__foot">
                                <Button
                                    variant="subtle"
                                    size="sm"
                                    icon="plus"
                                    onClick={() => onRegisterSourceForNamespace(ns)}>add source</Button>
                            </div>
                        </div>
                    }
                </section>
            })
        }
    </div>
}

export default SourcesListTable
