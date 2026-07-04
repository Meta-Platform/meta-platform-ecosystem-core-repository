import * as React from "react"
import { useState, useEffect } from "react"

import {
    Button,
    Grid,
    Icon,
    Input,
    Label,
    List,
    Loader,
    Menu,
    MenuItem,
    Modal,
    Segment,
    Tab,
    Popup
} from "semantic-ui-react"

import GetAPI from "../../Utils/GetAPI"
import { toastSuccess, toastError, errorMessage } from "../../Utils/toast"

import RegisterSourceModal from "../RepositorySources.container/RegisterSource.modal"
import AppModal from "../../Components/AppModal"
import Breadcrumbs from "../../Components/Breadcrumbs"
import ListSkeleton from "../../Components/Skeleton"
import EmptyState from "../../Components/EmptyState"
import { BuildPackageTree, TreeNode, PackageKey } from "../ApplicationsAndPackages.container/PackageTree"
import CopyValue from "../../Components/CopyValue"
import PackageIcon from "../../Components/PackageIcon"
import EntityHeader from "../../Components/ui/EntityHeader"

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
        return <div>
            {
                sources.length === 0 && <div style={{ color: "var(--mp-muted-2)", padding: "8px 0" }}>no sources registered</div>
            }
            {
                sources.map((source:any, key:number) => {
                    const isActive = installed && source.sourceType === activeSourceType
                    return <Segment key={key} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", background: isActive ? "#f4fbf5" : undefined }}>
                        <Icon name={SOURCE_ICON[source.sourceType] || "database"} color={isActive ? "green" : "grey"} fitted style={{ flex: "0 0 auto", margin: 0, fontSize: "1.15em" }}/>
                        <span style={{ width: "120px", fontWeight: 500 }}>{source.sourceType}</span>
                        <span style={{ flex: 1, color: "var(--mp-muted)", fontFamily: "monospace", fontSize: ".82em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={SOURCE_PARAM_SUMMARY(source)}>{SOURCE_PARAM_SUMMARY(source)}</span>
                        { isActive && <Label color="green" size="mini">active</Label> }
                        <Button.Group size="mini" basic>
                            <Popup content="install" trigger={<Button icon loading={isBusy(ns, "install", source.sourceType)} onClick={() => handleInstall(ns, source.sourceType)}><Icon name="download" color="blue"/></Button>}/>
                            { installed && !isActive && <Popup content="set active" trigger={<Button icon loading={isBusy(ns, "change", source.sourceType)} onClick={() => setConfirmChange({ ns, st: source.sourceType })}><Icon name="exchange"/></Button>}/> }
                            <Popup content="remove" trigger={<Button icon loading={isBusy(ns, "removeSource", source.sourceType)} onClick={() => setConfirmRemove({ ns, st: source.sourceType })}><Icon name="trash" color="red"/></Button>}/>
                        </Button.Group>
                    </Segment>
                })
            }
            <Button size="mini" basic style={{ marginTop: "8px" }} onClick={() => { setRegisterModalNamespace(ns); setIsRegisterModalOpen(true) }}>
                <Icon name="plus"/> add source
            </Button>
        </div>
    }

    const renderPackageDetail = () => {
        if(!selectedPackage)
            return <EmptyState
                icon="cube"
                title="No package selected"
                description="Select a package in the tree on the left to view its details."/>
        const p = selectedPackage
        const location = `${p.moduleName}.${p.layerName}${p.parentGroup ? `.${p.parentGroup}` : ""}`
        const rows = [
            ["package", `${p.packageName}.${p.ext}`],
            ["type", p.ext],
            ["repository", p.namespaceRepo],
            ["module", p.moduleName],
            ["layer", p.layerName],
            ...(p.parentGroup ? [["group", p.parentGroup]] : []),
            ["location", location]
        ]
        return <Segment>
            <EntityHeader
                iconNode={<PackageIcon packageData={p} serverManagerInformation={serverManagerInformation} size={26}/>}
                title={p.packageName}
                typeLabel={p.ext}
                subtitle={p.namespaceRepo}/>
            <List divided size="small">
                {
                    rows.map(([k, v]:any, idx:number) =>
                        <List.Item key={idx}>
                            <List.Content floated="right"><CopyValue value={String(v)}/></List.Content>
                            <List.Content>
                                <span style={{ color: "var(--mp-muted-2)" }}>{k}: </span>
                                <strong style={{ fontFamily: "monospace" }}>{v}</strong>
                            </List.Content>
                        </List.Item>)
                }
            </List>
        </Segment>
    }

    const renderPackagesPanel = (ns:string) => {
        const repoPackages = packageList
            .filter((p:any) => p.namespaceRepo === ns)
            .filter((p:any) => !packageFilter || `${p.moduleName} ${p.layerName} ${p.parentGroup || ""} ${p.packageName}.${p.ext}`.toLowerCase().includes(packageFilter.toLowerCase()))
        const tree = BuildPackageTree(repoPackages)
        const repoNode = tree[ns]
        const selectedKey = selectedPackage && PackageKey(selectedPackage)
        return <Grid divided style={{ marginTop: 0 }}>
            <Grid.Column width={9}>
                <Input icon="search" size="small" fluid placeholder="filter packages in this repo..." value={packageFilter} onChange={(e, { value }) => setPackageFilter(value)} style={{ marginBottom: "8px" }}/>
                <div style={{ overflow: "auto", maxHeight: "62vh", fontFamily: "system-ui, sans-serif", fontSize: ".95em" }}>
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
                        : <div style={{ color: "var(--mp-muted-2)", padding: "20px" }}>no packages installed in this repository</div>
                    }
                </div>
            </Grid.Column>
            <Grid.Column width={7}>
                { renderPackageDetail() }
            </Grid.Column>
        </Grid>
    }

    if(isLoading) return <Segment style={{ margin: "15px" }}><ListSkeleton lines={10}/></Segment>

    return <Segment style={{ margin: "10px" }}>
        <Menu secondary style={{ margin: 0, minHeight: 0 }}>
            <Menu.Menu position="right">
                <MenuItem><Button size="small" primary onClick={() => { setRegisterModalNamespace(undefined); setIsRegisterModalOpen(true) }}><Icon name="feed"/> register source</Button></MenuItem>
                <MenuItem><Button size="small" onClick={() => setIsAddNamespaceOpen(true)}><Icon name="plus"/> add namespace</Button></MenuItem>
            </Menu.Menu>
        </Menu>

        {
            repoSelected
            ? <div>
                <Breadcrumbs items={[ "Repositories & Packages", repoSelected, activeTab ]}/>
                <EntityHeader
                    icon="cubes"
                    title={repoSelected}
                    badges={
                        isInstalled(repoSelected)
                        ? <Label size="tiny" basic color="green">installed</Label>
                        : <Label size="tiny" basic color="grey">not installed</Label>
                    }
                    meta={isInstalled(repoSelected) ? [{ label: "source", value: getActiveSourceType(repoSelected) }] : []}
                    actions={
                        isInstalled(repoSelected)
                        ? <Button size="small" basic loading={isBusy(repoSelected, "update")} onClick={() => handleUpdate(repoSelected)}><Icon name="refresh"/> update repository</Button>
                        : undefined
                    }/>
                <Tab
                    menu={{ secondary: true, pointing: true }}
                    activeIndex={activeTab === "sources" ? 1 : 0}
                    onTabChange={(e:any, { activeIndex }:any) => onChangeTab && onChangeTab(activeIndex === 1 ? "sources" : "packages")}
                    panes={[
                        { menuItem: { key: "packages", content: <span><Icon name="cube"/> Packages</span> }, render: () => <Tab.Pane>{renderPackagesPanel(repoSelected)}</Tab.Pane> },
                        { menuItem: { key: "sources",  content: <span><Icon name="feed"/> Sources</span> },  render: () => <Tab.Pane>{renderSourcesPanel(repoSelected)}</Tab.Pane> }
                    ]}/>
            </div>
            : <div style={{ color: "var(--mp-muted-2)", padding: "20px" }}>select a repository in the tree on the left</div>
        }

        {
            isRegisterModalOpen &&
            <RegisterSourceModal namespaceOptions={repoNames} defaultNamespace={registerModalNamespace} isRegistering={isRegistering}
                onCancel={() => setIsRegisterModalOpen(false)} onRegister={handleRegisterSource}/>
        }
        {
            confirmRemove &&
            <AppModal
                variant="danger"
                open={true}
                header="Remove source"
                confirmText="remove"
                confirmIcon="trash"
                onCancel={() => setConfirmRemove(undefined)}
                onConfirm={handleConfirmRemove}>
                Remove <strong>{confirmRemove.st}</strong> from <strong>{confirmRemove.ns}</strong>? Changes <code>sources.json</code>.
            </AppModal>
        }
        {
            confirmChange &&
            <AppModal
                variant="edit"
                open={true}
                header="Change repository source"
                confirmText="change source"
                confirmIcon="exchange"
                onCancel={() => setConfirmChange(undefined)}
                onConfirm={handleConfirmChange}>
                Make <strong>{confirmChange.st}</strong> the active source of <strong>{confirmChange.ns}</strong>?
                <p style={{ color: "var(--mp-warning)", marginTop: "8px" }}>
                    <Icon name="warning sign"/> This reinstalls/realigns the repository from the new source and may impact what is running.
                </p>
            </AppModal>
        }
        {
            isAddNamespaceOpen &&
            <AppModal
                variant="info"
                open={true}
                header="New repository namespace"
                confirmText="create"
                confirmIcon="plus"
                confirmDisabled={!newNamespace}
                onCancel={() => setIsAddNamespaceOpen(false)}
                onConfirm={handleCreateNamespace}>
                <Input fluid autoFocus placeholder="e.g. my-repository" value={newNamespace || ""} onChange={(e, { value }) => setNewNamespace(value)}/>
                <div style={{ color: "var(--mp-muted)", fontSize: ".85em", marginTop: "6px" }}>Use lowercase letters, numbers and hyphens. E.g. <code>ecosystem-core</code></div>
            </AppModal>
        }
    </Segment>
}

export default RepositoriesAndPackagesContainer
