import * as React from "react"

import {
    Button,
    ButtonGroup,
    EmptyState,
    Icon,
    Panel,
    StatusChip
} from "@i-components"

import SourceParamsTable from "./SourceParams.table"

// Mostra um namespace com todas as suas fontes registradas e as ações de
// escrita disponíveis (paridade com o comando `repo`):
//  - install        -> instala o repositório a partir daquela fonte
//  - set as active  -> troca a fonte do repositório já instalado
//  - remove source  -> remove a fonte do sources.json
//  - update         -> atualiza o repositório instalado
const NamespaceSourcesCard = ({
    repositoryNamespace,
    sources,
    activeSourceType,
    isInstalled,
    busyAction,
    onInstall,
    onChangeSource,
    onRemoveSource,
    onUpdate,
    onRegisterSourceForNamespace
}:any) => {

    const isBusy = (action:string, sourceType?:string) =>
        busyAction && busyAction.namespace === repositoryNamespace
            && busyAction.action === action
            && (sourceType === undefined || busyAction.sourceType === sourceType)

    return <Panel
        className="ecp-namespace-card"
        icon="cubes"
        title={repositoryNamespace}
        actions={
            isInstalled
            ? <StatusChip icon="check circle" tone="success" label="installed"/>
            : <StatusChip label="not installed"/>
        }
        footer={
            <ButtonGroup>
                <Button
                    icon="plus"
                    onClick={() => onRegisterSourceForNamespace(repositoryNamespace)}>add source</Button>
                {
                    isInstalled &&
                    <Button
                        icon="refresh"
                        loading={isBusy("update")}
                        onClick={() => onUpdate(repositoryNamespace)}>update repository</Button>
                }
            </ButtonGroup>
        }>

        <div className="ecp-namespace-card__count">{sources.length} source(s) registered</div>

        {
            sources.length === 0
            && <EmptyState icon="feed" message="no sources registered"/>
        }
        {
            sources.map((source:any, key:number) => {
                const isActive = isInstalled && source.sourceType === activeSourceType
                return <section
                    key={key}
                    className={`ecp-source-block ${isActive ? "is-active" : ""}`.trim()}>
                    <header className="ecp-source-block__head">
                        <Icon
                            name={isActive ? "check circle" : "feed"}
                            tone={isActive ? "success" : "muted"}/>
                        <strong className="ecp-source-block__type">{source.sourceType}</strong>
                        { isActive && <StatusChip tone="success" label="active source"/> }
                    </header>

                    <SourceParamsTable repositorySourceData={source}/>

                    <ButtonGroup className="ecp-source-block__actions">
                        <Button
                            variant="primary"
                            size="sm"
                            icon="download"
                            loading={isBusy("install", source.sourceType)}
                            onClick={() => onInstall(repositoryNamespace, source.sourceType)}>install</Button>
                        {
                            isInstalled && !isActive &&
                            <Button
                                size="sm"
                                icon="exchange"
                                loading={isBusy("change", source.sourceType)}
                                onClick={() => onChangeSource(repositoryNamespace, source.sourceType)}>set active</Button>
                        }
                        <Button
                            variant="danger"
                            size="sm"
                            icon="trash"
                            loading={isBusy("removeSource", source.sourceType)}
                            onClick={() => onRemoveSource(repositoryNamespace, source.sourceType)}>remove</Button>
                    </ButtonGroup>
                </section>
            })
        }
    </Panel>
}

export default NamespaceSourcesCard
