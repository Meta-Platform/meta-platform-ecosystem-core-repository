import * as React from "react"
import { useState, useEffect } from "react"

import {
    Banner,
    Button,
    ConfirmDialog,
    CopyableMonoText,
    DataTable,
    Dialog,
    EmptyState,
    EntityHeader,
    FormField,
    Icon,
    Panel,
    SearchInput,
    SkeletonList,
    StatusChip,
    Surface,
    Tabs,
    TextInput,
    Toolbar
} from "@i-components"

import { GetAPI } from "@i-components/net"
import { toastSuccess, toastError, errorMessage } from "../../Utils/toast"

import RegisterSourceModal from "../RepositorySources.container/RegisterSource.modal"
import Breadcrumbs from "../../Components/Breadcrumbs"
import { BuildPackageTree, TreeNode, PackageKey } from "../ApplicationsAndPackages.container/PackageTree"
import PackageIcon from "../../Components/PackageIcon"

// Workspace unificado de Repositories & Packages (Sources + Packages juntos):
// lista de repositórios à esquerda; à direita, sub-abas Sources e Packages do
// repositório selecionado. Sources e Repositories foram unificados porque ambos
// são organizados por repositório (origem -> instalação -> pacotes).
const SOURCE_PARAM_SUMMARY = (source:any) => {
    if(source.sourceType === "LOCAL_FS")       return source.path
    if(source.sourceType === "GITHUB_RELEASE") return `${source.repositoryOwner || ""}/${source.repositoryName || ""}`
    if(source.sourceType === "GOOGLE_DRIVE")   return source.fileId
    return ""
}

// Ícone por tipo de fonte do repositório.
const SOURCE_ICON:any = {
    LOCAL_FS      : "folder open",
    GITHUB_RELEASE: "github",
    GOOGLE_DRIVE  : "google drive"
}

const RepositoriesAndPackagesContainer = ({
    serverManagerInformation,
    activeTab = "packages",
    onChangeTab,
    selectedRepo,
    onSelectRepo
}:any) => {

    const [ sourceList, setSourceList ]             = useState<any[]>([])
    const [ activeSourceList, setActiveSourceList ] = useState<any[]>([])
    const [ packageList, setPackageList ]           = useState<any[]>([])
    const [ isLoading, setIsLoading ]               = useState(true)

    // o repositório selecionado vem da sidebar (QueryParams.repo)
    const repoSelected = selectedRepo
    const [ packageFilter, setPackageFilter ]       = useState<string>("")
    const [ selectedPackage, setSelectedPackage ]   = useState<any>()

    const [ busyAction, setBusyAction ]             = useState<any>()
    const [ registerModalNamespace, setRegisterModalNamespace ] = useState<string | undefined>()
    const [ isRegisterModalOpen, setIsRegisterModalOpen ]       = useState(false)
    const [ isRegistering, setIsRegistering ]       = useState(false)
    const [ confirmRemove, setConfirmRemove ]       = useState<any>()
    const [ confirmChange, setConfirmChange ]       = useState<any>()
    const [ newNamespace, setNewNamespace ]         = useState<string>()
    const [ isAddNamespaceOpen, setIsAddNamespaceOpen ] = useState(false)

    const _GetSourcesAPI = () => GetAPI({ apiName: "Sources", serverManagerInformation })
    const _GetPackagesAPI = () => GetAPI({ apiName: "ApplicationsAndPackages", serverManagerInformation })

    useEffect(() => { updateAll() }, [])

    const updateAll = async () => {
        await Promise.all([ fetchSources(), fetchActiveSources(), fetchPackages() ])
        setIsLoading(false)
    }
    const fetchSources = async () => { try { setSourceList((await _GetSourcesAPI().ListSources()).data) } catch(e){ console.log(e) } }
    const fetchActiveSources = async () => { try { setActiveSourceList((await _GetSourcesAPI().ListActiveSources()).data) } catch(e){ console.log(e) } }
    const fetchPackages = async () => { try { setPackageList((await _GetPackagesAPI().ListPackages()).data) } catch(e){ console.log(e) } }

    // união de namespaces de sources + repos com pacotes
    const groupedSources = sourceList.reduce((acc:any, s:any) => {
        (acc[s.repositoryNamespace] = acc[s.repositoryNamespace] || []).push(s); return acc
    }, {})
    const repoCounts = packageList.reduce((acc:any, p:any) => { acc[p.namespaceRepo] = (acc[p.namespaceRepo] || 0) + 1; return acc }, {})
    const repoNames = Array.from(new Set([ ...Object.keys(groupedSources), ...Object.keys(repoCounts) ])).sort()

    useEffect(() => {
        if(!repoSelected && repoNames.length > 0 && onSelectRepo) onSelectRepo(repoNames[0])
    }, [sourceList, packageList])

    const isInstalled = (ns:string) => activeSourceList.some((a:any) => a.repositoryNamespace === ns)
    const getActiveSourceType = (ns:string) => {
        const a = activeSourceList.find((x:any) => x.repositoryNamespace === ns)
        return a && a.sourceData && a.sourceData.sourceType
    }

    const ACTION_LABEL:any = { install: "Install", change: "Source change", update: "Update", removeSource: "Source removal" }
    const runAction = async (busy:any, call:any) => {
        try {
            setBusyAction(busy)
            await call()
            await updateAll()
            toastSuccess(`${ACTION_LABEL[busy.action] || busy.action} done${busy.namespace ? ` — ${busy.namespace}` : ""}`)
        } catch(e) {
            toastError(errorMessage(e))
        } finally { setBusyAction(undefined) }
    }
    const isBusy = (ns:string, action:string, st?:string) =>
        busyAction && busyAction.namespace === ns && busyAction.action === action && (st === undefined || busyAction.sourceType === st)

    const handleInstall = (ns:string, st:string) => runAction({ namespace: ns, action: "install", sourceType: st }, () => _GetSourcesAPI().InstallRepository({ repositoryNamespace: ns, sourceType: st }))
    const handleChange  = (ns:string, st:string) => runAction({ namespace: ns, action: "change", sourceType: st }, () => _GetSourcesAPI().ChangeRepositorySource({ repositoryNamespace: ns, sourceType: st }))
    const handleUpdate  = (ns:string) => runAction({ namespace: ns, action: "update" }, () => _GetSourcesAPI().UpdateRepository({ repositoryNamespace: ns }))
    const handleConfirmRemove = () => {
        const { ns, st } = confirmRemove; setConfirmRemove(undefined)
        runAction({ namespace: ns, action: "removeSource", sourceType: st }, () => _GetSourcesAPI().RemoveSource({ repositoryNamespace: ns, sourceType: st }))
    }
    const handleConfirmChange = () => {
        const { ns, st } = confirmChange; setConfirmChange(undefined)
        handleChange(ns, st)
    }
    const handleRegisterSource = async (args:any) => {
        try { setIsRegistering(true); await _GetSourcesAPI().RegisterNewSource(args); await updateAll(); setIsRegisterModalOpen(false); toastSuccess(`Fonte ${args.sourceType} registrada em ${args.repositoryNamespace}`) }
        catch(e){ toastError(errorMessage(e)) } finally { setIsRegistering(false) }
    }
    const handleCreateNamespace = async () => {
        try { await _GetSourcesAPI().CreateNewRepositoryNamespace({ repositoryNamespace: newNamespace }); await updateAll(); setIsAddNamespaceOpen(false); const created = newNamespace; setNewNamespace(undefined); onSelectRepo && onSelectRepo(created); toastSuccess(`Namespace ${created} criado`) }
        catch(e){ toastError(errorMessage(e)) }
    }

    // ---- painel direito ----
    const renderSourcesPanel = (ns:string) => {
        const sources = groupedSources[ns] || []
        const activeSourceType = getActiveSourceType(ns)
        const installed = isInstalled(ns)
        return <div className="ecp-repo-sources">
            {
                sources.length === 0 &&
                <EmptyState icon="feed" message="no sources registered"/>
            }
            {
                sources.map((source:any, key:number) => {
                    const isActive = installed && source.sourceType === activeSourceType
                    return <div key={key} className={`ecp-source-row ${isActive ? "is-active" : ""}`.trim()}>
                        <Icon name={SOURCE_ICON[source.sourceType] || "database"} tone={isActive ? "success" : "muted"}/>
                        <span className="ecp-source-row__type">{source.sourceType}</span>
                        <span className="ecp-source-row__summary">
                            <CopyableMonoText value={SOURCE_PARAM_SUMMARY(source) || ""} maxChars={52}/>
                        </span>
                        { isActive && <StatusChip tone="success" label="active"/> }
                        <span className="ecp-source-row__actions">
                            <Button
                                variant="subtle" size="sm" icon="download"
                                title="install" aria-label="install"
                                loading={isBusy(ns, "install", source.sourceType)}
                                onClick={() => handleInstall(ns, source.sourceType)}/>
                            {
                                installed && !isActive &&
                                <Button
                                    variant="subtle" size="sm" icon="exchange"
                                    title="set active" aria-label="set active"
                                    loading={isBusy(ns, "change", source.sourceType)}
                                    onClick={() => setConfirmChange({ ns, st: source.sourceType })}/>
                            }
                            <Button
                                variant="danger" size="sm" icon="trash"
                                title="remove" aria-label="remove"
                                loading={isBusy(ns, "removeSource", source.sourceType)}
                                onClick={() => setConfirmRemove({ ns, st: source.sourceType })}/>
                        </span>
                    </div>
                })
            }
            <div className="ecp-repo-sources__foot">
                <Button
                    variant="subtle" size="sm" icon="plus"
                    onClick={() => { setRegisterModalNamespace(ns); setIsRegisterModalOpen(true) }}>add source</Button>
            </div>
        </div>
    }

    const renderPackageDetail = () => {
        if(!selectedPackage)
            return <EmptyState
                icon="cube"
                title="No package selected"
                message="Select a package in the tree on the left to view its details."/>
        const p = selectedPackage
        const location = `${p.moduleName}.${p.layerName}${p.parentGroup ? `.${p.parentGroup}` : ""}`
        const rows = [
            { field: "package",    value: `${p.packageName}.${p.ext}` },
            { field: "type",       value: p.ext },
            { field: "repository", value: p.namespaceRepo },
            { field: "module",     value: p.moduleName },
            { field: "layer",      value: p.layerName },
            ...(p.parentGroup ? [ { field: "group", value: p.parentGroup } ] : []),
            { field: "location",   value: location }
        ]
        return <Panel className="ecp-package-detail">
            <EntityHeader
                className="ecp-package-detail__header"
                iconNode={<PackageIcon packageData={p} serverManagerInformation={serverManagerInformation} size={26}/>}
                title={p.packageName}
                typeLabel={p.ext}
                subtitle={p.namespaceRepo}/>
            <DataTable
                dense
                rowKey={(row:any) => row.field}
                columns={[
                    { key: "field", header: "field", width: "30%" },
                    {
                        key: "value",
                        header: "value",
                        render: (row:any) => <CopyableMonoText value={String(row.value)} maxChars={44}/>
                    }
                ]}
                rows={rows}/>
        </Panel>
    }

    const renderPackagesPanel = (ns:string) => {
        const repoPackages = packageList
            .filter((p:any) => p.namespaceRepo === ns)
            .filter((p:any) => !packageFilter || `${p.moduleName} ${p.layerName} ${p.parentGroup || ""} ${p.packageName}.${p.ext}`.toLowerCase().includes(packageFilter.toLowerCase()))
        const tree = BuildPackageTree(repoPackages)
        const repoNode = tree[ns]
        const selectedKey = selectedPackage && PackageKey(selectedPackage)
        return <div className="ecp-repo-split">
            <div className="ecp-repo-split__tree">
                <SearchInput
                    value={packageFilter}
                    onValueChange={setPackageFilter}
                    placeholder="filter packages in this repo..."/>
                <div className="ecp-repo-split__scroll">
                    {
                        repoNode
                        ? Object.keys(repoNode.__children).sort().map((moduleName:string) =>
                            <TreeNode
                                key={moduleName}
                                name={moduleName}
                                node={repoNode.__children[moduleName]}
                                defaultOpen={true}
                                selectedKey={selectedKey}
                                onSelectPackage={setSelectedPackage}
                                serverManagerInformation={serverManagerInformation}/>)
                        : <EmptyState icon="cube" message="no packages installed in this repository"/>
                    }
                </div>
            </div>
            <div className="ecp-repo-split__detail">
                { renderPackageDetail() }
            </div>
        </div>
    }

    if(isLoading) return <Surface className="ecp-repos-page"><SkeletonList rows={10}/></Surface>

    return <div className="ecp-repos-page">
        <Toolbar className="ecp-repos-page__bar">
            <Toolbar.Spacer/>
            <Button variant="primary" size="sm" icon="feed" onClick={() => { setRegisterModalNamespace(undefined); setIsRegisterModalOpen(true) }}>register source</Button>
            <Button size="sm" icon="plus" onClick={() => setIsAddNamespaceOpen(true)}>add namespace</Button>
        </Toolbar>

        {
            repoSelected
            ? <div className="ecp-repos-page__entity">
                <Breadcrumbs items={[ "Repositories & Packages", repoSelected, activeTab ]}/>
                <EntityHeader
                    className="ecp-repos-page__header"
                    icon="cubes"
                    title={repoSelected}
                    badges={
                        isInstalled(repoSelected)
                        ? <StatusChip tone="success" label="installed"/>
                        : <StatusChip label="not installed"/>
                    }
                    meta={isInstalled(repoSelected) ? [{ label: "source", value: getActiveSourceType(repoSelected) }] : []}
                    actions={
                        isInstalled(repoSelected)
                        ? <Button size="sm" icon="refresh" loading={isBusy(repoSelected, "update")} onClick={() => handleUpdate(repoSelected)}>update repository</Button>
                        : undefined
                    }/>
                { /* o Tabs do kit é só a barra: o conteúdo da aba vem abaixo */ }
                <Tabs
                    className="ecp-repos-page__tabs"
                    tabs={[
                        { key: "packages", label: "Packages", icon: "cube" },
                        { key: "sources",  label: "Sources",  icon: "feed" }
                    ]}
                    activeKey={activeTab === "sources" ? "sources" : "packages"}
                    onChange={(key:string) => onChangeTab && onChangeTab(key)}/>
                <div className="ecp-repos-page__pane">
                    {
                        activeTab === "sources"
                        ? renderSourcesPanel(repoSelected)
                        : renderPackagesPanel(repoSelected)
                    }
                </div>
            </div>
            : <EmptyState icon="cubes" message="select a repository in the tree on the left"/>
        }

        {
            isRegisterModalOpen &&
            <RegisterSourceModal namespaceOptions={repoNames} defaultNamespace={registerModalNamespace} isRegistering={isRegistering}
                onCancel={() => setIsRegisterModalOpen(false)} onRegister={handleRegisterSource}/>
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
                onConfirm={handleConfirmRemove}
                message={<>Remove <strong>{confirmRemove.st}</strong> from <strong>{confirmRemove.ns}</strong>? Changes <code>sources.json</code>.</>}/>
        }
        {
            confirmChange &&
            <ConfirmDialog
                open={true}
                title="Change repository source"
                confirmLabel="change source"
                cancelLabel="cancel"
                onCancel={() => setConfirmChange(undefined)}
                onConfirm={handleConfirmChange}
                message={<>
                    Make <strong>{confirmChange.st}</strong> the active source of <strong>{confirmChange.ns}</strong>?
                    <Banner tone="warning" className="ecp-confirm-note">
                        This reinstalls/realigns the repository from the new source and may impact what is running.
                    </Banner>
                </>}/>
        }
        {
            isAddNamespaceOpen &&
            <Dialog
                open={true}
                size="sm"
                icon="plus"
                title="New repository namespace"
                onClose={() => setIsAddNamespaceOpen(false)}
                actions={<>
                    <Button onClick={() => setIsAddNamespaceOpen(false)}>cancel</Button>
                    <Button variant="primary" icon="plus" disabled={!newNamespace} onClick={handleCreateNamespace}>create</Button>
                </>}>
                <FormField
                    htmlFor="ecp-new-namespace"
                    hint="Use lowercase letters, numbers and hyphens. E.g. ecosystem-core">
                    <TextInput
                        id="ecp-new-namespace"
                        autoFocus
                        placeholder="e.g. my-repository"
                        value={newNamespace || ""}
                        onChange={({ target: { value } }:any) => setNewNamespace(value)}/>
                </FormField>
            </Dialog>
        }
    </div>
}

export default RepositoriesAndPackagesContainer
