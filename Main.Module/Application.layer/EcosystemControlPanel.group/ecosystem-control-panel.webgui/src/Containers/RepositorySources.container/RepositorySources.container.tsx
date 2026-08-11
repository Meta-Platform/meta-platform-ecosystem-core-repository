import * as React from "react"
import { useState, useEffect } from "react"

import {
    Button,
    ConfirmDialog,
    PageMasthead,
    SkeletonList,
    StatusChip,
    StatusStrip,
    Surface
} from "@i-components"

import GetAPI from "../../Utils/GetAPI"

import SourcesListTable        from "./SourcesList.table"
import RegisterSourceModal     from "./RegisterSource.modal"
import NewRepositorySourceCard from "./NewRepositorySource.card"

const GroupSources = (sourceList) =>
    sourceList.reduce((acc, source) => {
        if(!acc[source.repositoryNamespace])
            acc[source.repositoryNamespace] = []
        acc[source.repositoryNamespace].push(source)
        return acc
    }, {})

const RepositorySourcesContainer = ({ serverManagerInformation }:any) => {

    const [ sourceList, setSourceList ]             = useState<any[]>([])
    const [ activeSourceList, setActiveSourceList ] = useState<any[]>([])
    const [ isLoading, setIsLoading ]               = useState(true)

    const [ newRepoMode, setNewRepoMode ]           = useState(false)
    const [ registerModalNamespace, setRegisterModalNamespace ] = useState<string | undefined>()
    const [ isRegisterModalOpen, setIsRegisterModalOpen ]       = useState(false)
    const [ isRegistering, setIsRegistering ]       = useState(false)
    const [ confirmRemove, setConfirmRemove ]       = useState<any>()

    // { namespace, action, sourceType } da ação de escrita em andamento
    const [ busyAction, setBusyAction ]             = useState<any>()

    const _GetSourcesAPI = () =>
        GetAPI({ apiName: "Sources", serverManagerInformation })

    useEffect(() => {
        updateAllList()
    }, [])

    const updateAllList = async () => {
        await Promise.all([ fetchSourceList(), fetchActiveSourceList() ])
        setIsLoading(false)
    }

    const fetchSourceList = async () => {
        try {
            const response = await _GetSourcesAPI().ListSources()
            setSourceList(response.data)
        } catch(e) { console.log(e) }
    }

    const fetchActiveSourceList = async () => {
        try {
            const response = await _GetSourcesAPI().ListActiveSources()
            setActiveSourceList(response.data)
        } catch(e) { console.log(e) }
    }

    // Executa uma ação de escrita, marcando o estado de "busy" e atualizando as
    // listas ao final. O progresso detalhado chega pelo painel de Notifications.
    const runAction = async (busy, apiCall) => {
        try {
            setBusyAction(busy)
            await apiCall()
            await updateAllList()
        } catch(e) {
            console.log(e)
        } finally {
            setBusyAction(undefined)
        }
    }

    const handleInstall = (repositoryNamespace, sourceType) =>
        runAction({ namespace: repositoryNamespace, action: "install", sourceType },
            () => _GetSourcesAPI().InstallRepository({ repositoryNamespace, sourceType }))

    const handleChangeSource = (repositoryNamespace, sourceType) =>
        runAction({ namespace: repositoryNamespace, action: "change", sourceType },
            () => _GetSourcesAPI().ChangeRepositorySource({ repositoryNamespace, sourceType }))

    const handleUpdate = (repositoryNamespace) =>
        runAction({ namespace: repositoryNamespace, action: "update" },
            () => _GetSourcesAPI().UpdateRepository({ repositoryNamespace }))

    const handleConfirmRemoveSource = () => {
        const { repositoryNamespace, sourceType } = confirmRemove
        setConfirmRemove(undefined)
        runAction({ namespace: repositoryNamespace, action: "removeSource", sourceType },
            () => _GetSourcesAPI().RemoveSource({ repositoryNamespace, sourceType }))
    }

    const handleCreateNamespace = async (repositoryNamespace) => {
        try {
            await _GetSourcesAPI().CreateNewRepositoryNamespace({ repositoryNamespace })
            await updateAllList()
            setNewRepoMode(false)
        } catch(e) { console.log(e) }
    }

    const handleRegisterSource = async (registerArgs) => {
        try {
            setIsRegistering(true)
            await _GetSourcesAPI().RegisterNewSource(registerArgs)
            await updateAllList()
            setIsRegisterModalOpen(false)
        } catch(e) {
            console.log(e)
        } finally {
            setIsRegistering(false)
        }
    }

    const openRegisterModal = (namespace?:string) => {
        setRegisterModalNamespace(namespace)
        setIsRegisterModalOpen(true)
    }

    const groupedSources = GroupSources(sourceList)

    const getActiveSourceType = (repositoryNamespace) => {
        const active = activeSourceList.find((a) => a.repositoryNamespace === repositoryNamespace)
        return active && active.sourceData && active.sourceData.sourceType
    }

    const isInstalled = (repositoryNamespace) =>
        activeSourceList.some((a) => a.repositoryNamespace === repositoryNamespace)

    const namespaceNames = Object.keys(groupedSources)
    const installedCount = namespaceNames.filter((ns) => isInstalled(ns)).length

    return <div className="ecp-sources-page">
        <PageMasthead
            icon="feed"
            title="Repository Sources"
            subtitle="registered sources per repository namespace"
            actions={<>
                <Button variant="primary" icon="feed" onClick={() => openRegisterModal(undefined)}>register source</Button>
                <Button icon="plus" onClick={() => setNewRepoMode(true)} disabled={newRepoMode}>add namespace</Button>
            </>}>
            <StatusStrip>
                <StatusChip icon="cubes" count={namespaceNames.length} label="namespaces"/>
                <StatusChip icon="check circle" tone="success" count={installedCount} label="installed"/>
                <StatusChip icon="feed" count={sourceList.length} label="sources"/>
            </StatusStrip>
        </PageMasthead>

        <Surface className="ecp-sources-page__body">
            {
                newRepoMode &&
                <div className="ecp-sources-page__new-repo">
                    <NewRepositorySourceCard
                        onCancel={() => setNewRepoMode(false)}
                        onCreateRepositoryNamespace={handleCreateNamespace}/>
                </div>
            }
            {
                isLoading
                ? <SkeletonList rows={6}/>
                : <div className="ecp-sources-page__scroll">
                    <SourcesListTable
                        groupedSources={groupedSources}
                        getActiveSourceType={getActiveSourceType}
                        isInstalled={isInstalled}
                        busyAction={busyAction}
                        onInstall={handleInstall}
                        onChangeSource={handleChangeSource}
                        onRemoveSource={(ns, st) => setConfirmRemove({ repositoryNamespace: ns, sourceType: st })}
                        onUpdate={handleUpdate}
                        onRegisterSourceForNamespace={openRegisterModal}/>
                </div>
            }
        </Surface>

        {
            isRegisterModalOpen &&
            <RegisterSourceModal
                namespaceOptions={Object.keys(groupedSources)}
                defaultNamespace={registerModalNamespace}
                isRegistering={isRegistering}
                onCancel={() => setIsRegisterModalOpen(false)}
                onRegister={handleRegisterSource}/>
        }

        {
            confirmRemove &&
            <ConfirmDialog
                open={true}
                danger
                title="Remove source"
                confirmLabel="remove"
                cancelLabel="cancel"
                onCancel={() => setConfirmRemove(undefined)}
                onConfirm={handleConfirmRemoveSource}
                message={<>
                    Remove the <strong>{confirmRemove.sourceType}</strong> source from
                    <strong> {confirmRemove.repositoryNamespace}</strong>? This changes <code>sources.json</code>.
                </>}/>
        }
    </div>
}

export default RepositorySourcesContainer
