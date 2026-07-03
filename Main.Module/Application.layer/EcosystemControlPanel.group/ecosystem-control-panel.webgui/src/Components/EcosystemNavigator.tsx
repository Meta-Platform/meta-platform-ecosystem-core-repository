import * as React from "react"
import { useState, useEffect } from "react"

import {
    Accordion,
    Icon,
    Image,
    Input,
    List,
    Label,
    Loader
} from "semantic-ui-react"

import GetAPI       from "../Utils/GetAPI"
import useWebSocket from "../Hooks/useWebSocket"
import { GetStatusColor } from "./StatusBadge"
import { subscribeLogWindows } from "../Utils/logWindows"
import GetExecutableIconURL from "../Utils/GetExecutableIconURL"

// O nome de um environment segue o padrão "<package-name>.<type>-<hash>".
// Quando o pacote muda de lugar no filesystem, um novo hash (logo, um novo
// environment) é criado. Agrupamos pela identidade do pacote (sem o hash)
// para colapsar essas duplicatas.
const ExtractPackageIdentity = (environmentName:string) => {
    const index = environmentName.lastIndexOf("-")
    return index !== -1 ? environmentName.slice(0, index) : environmentName
}

const ExtractEnvironmentHash = (environmentName:string) => {
    const index = environmentName.lastIndexOf("-")
    return index !== -1 ? environmentName.slice(index + 1) : environmentName
}

const ShortHash = (hash:string) => hash.length > 10 ? `${hash.slice(0, 10)}…` : hash

const NormalizePath = (value:string) => (value || "").replace(/\\/g, "/").replace(/\/+$/, "")

const GetParentDir = (filePath:string) => {
    const normalized = NormalizePath(filePath)
    const index = normalized.lastIndexOf("/")
    return index > 0 ? normalized.slice(0, index) : ""
}

const GetCommonDirPrefix = (paths:string[]) => {
    const normalized = paths
        .map((p) => NormalizePath(p))
        .filter(Boolean)
    if(normalized.length === 0) return ""
    const splitPaths = normalized.map((p) => p.split("/"))
    const prefix:string[] = []
    const first = splitPaths[0]
    for(let i = 0; i < first.length; i++) {
        const segment = first[i]
        if(splitPaths.every((parts) => parts[i] === segment))
            prefix.push(segment)
        else
            break
    }
    return prefix.length > 0 ? prefix.join("/") : ""
}

// Executável interno de baixo nível do ecossistema — oculto no navegador.
const IGNORED_EXECUTABLES = ["execute-application", "execute-command-line-application", "execute-desktop-application"]
// também ignora os correspondentes -dbg
const IsIgnoredExecutable = (executableName:string) => IGNORED_EXECUTABLES.includes(executableName.replace(/-dbg$/, ""))

// nome curto do repositório a partir do caminho completo (REPOSITORY_PATH)
const RepoName = (repositoryPath:string) => {
    if(!repositoryPath) return "—"
    return repositoryPath.split("/").filter(Boolean).pop() || repositoryPath
}

const EXEC_TYPE_GROUPS = [
    { type: "application", label: "Application / Daemon", icon: "desktop"  },
    { type: "cli",         label: "Command Line",        icon: "terminal" }
]

// Nome legível da instância a partir do caminho do socket de supervisão
// (ex.: .../supervisor-sockets/eco-panel.sock -> "eco-panel").
const GetSocketName = (filePath:string) => {
    if(!filePath) return ""
    const base = filePath.split("/").pop() || filePath
    return base.replace(/\.sock$/, "")
}

const ExecutableIcon = ({ executable, fallbackIcon, serverManagerInformation }:any) => {
    const iconURL = executable.hasPackageIcon
        ? GetExecutableIconURL({ serverManagerInformation, executableName: executable.executableName })
        : undefined

    if(iconURL)
        return <Image src={iconURL} title="icone do pacote" style={{ width: "18px", height: "18px", objectFit: "contain", flex: "0 0 auto", margin: 0 }}/>

    return <Icon name={fallbackIcon}/>
}

const GroupEnvironmentsByPackageIdentity = (environmentNameList:string[]) =>
    environmentNameList.reduce((groups:any, environmentName:string) => {
        const identity = ExtractPackageIdentity(environmentName)
        if(!groups[identity])
            groups[identity] = []
        groups[identity].push(environmentName)
        return groups
    }, {})

// Título de seção: layout flex para que o rótulo trunque com reticências e o
// contador fique SEMPRE fixo à direita, na mesma linha (antes o badge quebrava
// para a linha de baixo em sidebars estreitas).
const SectionTitle = ({ iconName, label, count }:any) =>
    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", minWidth: 0, flex: "1 1 auto", verticalAlign: "middle" }}>
        <Icon name={iconName} style={{ flex: "0 0 auto", margin: 0 }}/>
        <strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{label}</strong>
        { count !== undefined && <Label circular size="mini" style={{ flex: "0 0 auto", margin: 0 }}>{count}</Label> }
    </span>

const EcosystemNavigator = ({
    serverManagerInformation,
    ecosystemdataPath,
    activeItem,
    selection = {},
    onNavigate
}:any) => {

    const [ overview, setOverview ]                 = useState<any>({})
    const [ environmentNameList, setEnvironmentNameList ] = useState<string[]>([])
    const [ configFileList, setConfigFileList ]     = useState<string[]>([])
    const [ executableList, setExecutableList ]     = useState<any[]>([])
    const [ repoNamespaceList, setRepoNamespaceList ] = useState<string[]>([])
    const [ showDebugExecutables, setShowDebugExecutables ] = useState<boolean>(false)
    const [ isLoading, setIsLoading ]               = useState(true)

    const [ openSections, setOpenSections ] = useState<any>({ sockets: true, environments: false })
    const [ openGroups, setOpenGroups ]     = useState<any>({})
    const [ openExecGroups, setOpenExecGroups ] = useState<any>({})
    const [ openExecRepos, setOpenExecRepos ]   = useState<any>({})
    const [ navFilter, setNavFilter ]       = useState<string>("")
    const [ logKeys, setLogKeys ]           = useState<string[]>([])

    useEffect(() => subscribeLogWindows((ws:any[]) => setLogKeys(ws.map((w) => w.monitoringStateKey))), [])

    const _GetSupervisorAPI = () =>
        GetAPI({ apiName: "InstancesSupervisor", serverManagerInformation })

    const _GetEnvironmentsAPI = () =>
        GetAPI({ apiName: "Environments", serverManagerInformation })

    const _GetConfigurationsAPI = () =>
        GetAPI({ apiName: "Configurations", serverManagerInformation })

    const _GetExecutablesAPI = () =>
        GetAPI({ apiName: "Executables", serverManagerInformation })

    const _GetSourcesAPI = () =>
        GetAPI({ apiName: "Sources", serverManagerInformation })

    useEffect(() => {
        fetchAll()
    }, [])

    useWebSocket({
        socket          : _GetSupervisorAPI().InstanceOverviewChange,
        onMessage       : (newOverview:any) => setOverview(newOverview),
        onConnection    : () => {},
        onDisconnection : () => {}
    })

    const fetchAll = async () => {
        try {
            const [ overviewResponse, environmentsResponse, configFilesResponse, executablesResponse, sourcesResponse ] = await Promise.all([
                _GetSupervisorAPI().Overview(),
                _GetEnvironmentsAPI().ListEnvironments(),
                _GetConfigurationsAPI().ListConfigFiles(),
                _GetExecutablesAPI().ListExecutables(),
                _GetSourcesAPI().ListSources()
            ])
            setOverview(overviewResponse.data)
            setEnvironmentNameList(environmentsResponse.data)
            setConfigFileList(configFilesResponse.data)
            setExecutableList(executablesResponse.data)
            const namespaces = Array.from(new Set((sourcesResponse.data || []).map((s:any) => s.repositoryNamespace))).sort()
            setRepoNamespaceList(namespaces as string[])
        } catch(e) {
            console.log(e)
        } finally {
            setIsLoading(false)
        }
    }

    const toggleSection = (sectionName:string) =>
        setOpenSections({ ...openSections, [sectionName]: !openSections[sectionName] })

    const toggleGroup = (groupName:string) =>
        setOpenGroups({ ...openGroups, [groupName]: !openGroups[groupName] })

    const isActivePanel = (panel:string) => activeItem === panel

    // busca: filtra os itens de cada seção; com filtro ativo, expande tudo.
    const filtering = navFilter.trim().length > 0
    const matchNav = (text:string) => !filtering || (text || "").toLowerCase().includes(navFilter.toLowerCase())

    const filteredOverviewKeys = Object.keys(overview)
        .filter((k) => matchNav(`${GetSocketName(overview[k]?.filePath)} ${k}`))
    const visibleOverviewKeys = filteredOverviewKeys.filter((monitoringStateKey) => overview[monitoringStateKey]?.status !== "UNAVAILABLE")
    const hiddenUnavailableCount = filteredOverviewKeys.length - visibleOverviewKeys.length
    // Raiz dos sockets de supervisão: o prefixo comum é calculado sobre os
    // diretórios-pais (e não sobre os caminhos dos arquivos, senão o nome do
    // .sock entra no prefixo e, com um único socket, o caminho absoluto acabava
    // aparecendo no menu). O rótulo da raiz é o nome da pasta de supervisão; as
    // subpastas aparecem com caminho relativo a ela — nunca o absoluto.
    const overviewParentDirs = visibleOverviewKeys.map((monitoringStateKey) => GetParentDir(overview[monitoringStateKey]?.filePath)).filter(Boolean)
    const socketsRootDir = GetCommonDirPrefix(overviewParentDirs)
    const socketsRootLabel = socketsRootDir.split("/").filter(Boolean).pop() || "supervisor"
    const overviewSocketGroups = visibleOverviewKeys.reduce((groups:any, monitoringStateKey:string) => {
        const info = overview[monitoringStateKey] || {}
        const parentDir = GetParentDir(info.filePath)
        const relativeDir = socketsRootDir && parentDir.startsWith(socketsRootDir)
            ? parentDir.slice(socketsRootDir.length).replace(/^\/+/, "")
            : parentDir
        const groupKey = relativeDir || "__root__"
        const groupLabel = relativeDir || socketsRootLabel
        if(!groups[groupKey])
            groups[groupKey] = { groupKey, groupLabel, items: [] }
        groups[groupKey].items.push(monitoringStateKey)
        return groups
    }, {})
    const overviewSocketGroupList = Object.values(overviewSocketGroups).sort((a:any, b:any) => a.groupLabel.localeCompare(b.groupLabel))
    const filteredExecutables = executableList
        .filter((e:any) => !IsIgnoredExecutable(e.executableName) && (showDebugExecutables || !e.isDebug) && matchNav(`${e.executableName} ${e.type} ${RepoName(e.repositoryPath)}`))
    // agrupa os executáveis por tipo (1º nível: Application / Command Line) e,
    // dentro de cada tipo, por repositório (2º nível).
    const execTypeGroups = EXEC_TYPE_GROUPS.map((group:any) => {
        const items = filteredExecutables.filter((e:any) => e.type === group.type)
        const byRepo:any = {}
        items.forEach((e:any) => {
            const repo = RepoName(e.repositoryPath)
            if(!byRepo[repo]) byRepo[repo] = { repo, repositoryPath: e.repositoryPath, items: [] }
            byRepo[repo].items.push(e)
        })
        const repoGroups = Object.values(byRepo).sort((a:any, b:any) => a.repo.localeCompare(b.repo))
        return { ...group, items, repoGroups }
    })
    const filteredEnvNames = environmentNameList.filter((n:string) => matchNav(n))
    const groupedEnvironments = GroupEnvironmentsByPackageIdentity(filteredEnvNames)
    const filteredRepoNames = repoNamespaceList.filter((n:string) => matchNav(n))
    const filteredConfigFiles = configFileList.filter((n:string) => matchNav(n))

    return <div className="eco-navigator">

        { isLoading && <Loader active inline="centered" size="small" style={{ margin: "20px" }}/> }

        <Input
            icon="search"
            size="small"
            fluid
            placeholder="buscar..."
            value={navFilter}
            onChange={(e, { value }) => setNavFilter(value)}
            style={{ marginBottom: "6px" }}/>

        <Accordion fluid styled>

            { /* Sockets — clique abre o Overview e lista os sockets */ }
            <Accordion.Title
                active={openSections.sockets}
                onClick={() => { toggleSection("sockets"); onNavigate({ panel: "instance supervisor", params: { monitoringStateKey: undefined } }) }}>
                <Icon name="dropdown"/>
                <SectionTitle iconName="server" label="Sockets de supervisor" count={visibleOverviewKeys.length}/>
            </Accordion.Title>
            <Accordion.Content active={openSections.sockets || filtering}>
                {
                    overviewSocketGroupList.map((group:any) =>
                        <div key={group.groupKey} style={{ marginBottom: "6px" }}>
                            <div style={{ padding: "5px 6px", color: "#6a7480", fontSize: ".85em", fontWeight: 700, textTransform: "uppercase" }}>
                                {group.groupLabel}
                            </div>
                            <List selection size="small" style={{ marginTop: 0 }}>
                                {
                                    group.items.map((monitoringStateKey:string, key:number) => {
                                        const info = overview[monitoringStateKey] || {}
                                        const socketName = GetSocketName(info.filePath) || ShortHash(monitoringStateKey)
                                        return <List.Item
                                            key={key}
                                            active={selection.monitoringStateKey === monitoringStateKey}
                                            onClick={() => onNavigate({ panel: "instance supervisor", params: { monitoringStateKey } })}>
                                            <List.Content>
                                                <Icon name="plug" size="small" color={GetStatusColor(info.status)}/>
                                                <span title={monitoringStateKey}>{socketName}</span>
                                                { logKeys.includes(monitoringStateKey) && <Icon name="terminal" size="small" color="blue" className="eco-log-live" style={{ marginLeft: "6px" }} title="log stream ao vivo"/> }
                                            </List.Content>
                                        </List.Item>
                                        })
                                }
                            </List>
                        </div>)
                }
                { hiddenUnavailableCount > 0 && <div style={{ color: "#7b8794", fontSize: ".85em", padding: "6px 6px 0" }}>{hiddenUnavailableCount} sockets indisponíveis ocultos</div> }
            </Accordion.Content>

            { /* Executables (executables/) — 2º nó, irmão de repos/ no EcosystemData */ }
            <Accordion.Title
                active={openSections.executables}
                onClick={() => { toggleSection("executables"); onNavigate({ panel: "executables", params: { executableName: undefined, executableType: undefined, executableRepo: undefined, executableStatus: undefined } }) }}>
                <Icon name="dropdown"/>
                <SectionTitle iconName="terminal" label="Executables"
                    count={executableList.filter((e:any) => !IsIgnoredExecutable(e.executableName) && !e.isDebug).length}/>
            </Accordion.Title>
            <Accordion.Content active={openSections.executables || filtering}>
                {
                    execTypeGroups.map((group:any) => {
                        if(group.items.length === 0) return null
                        const typeOpen = openExecGroups[group.type] || filtering
                        return <div key={group.type} style={{ marginBottom: "4px" }}>
                            <div
                                onClick={() => {
                                    setOpenExecGroups({ ...openExecGroups, [group.type]: !openExecGroups[group.type] })
                                    onNavigate({ panel: "executables", params: { executableType: group.type, executableRepo: undefined, executableName: undefined } })
                                }}
                                className={`eco-nav-subtitle ${selection.executableType === group.type && !selection.executableRepo ? "active" : ""}`}>
                                <Icon name={typeOpen ? "caret down" : "caret right"} style={{ flex: "0 0 auto", margin: 0 }}/>
                                <Icon name={group.icon} style={{ flex: "0 0 auto", margin: 0 }}/>
                                <span style={{ flex: "1 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{group.label}</span>
                                <Label circular size="mini" style={{ flex: "0 0 auto", margin: 0 }}>{group.items.length}</Label>
                            </div>
                            {
                                typeOpen &&
                                <div style={{ paddingLeft: "10px" }}>
                                    {
                                        group.repoGroups.map((repoGroup:any) => {
                                            const repoKey = `${group.type}::${repoGroup.repo}`
                                            const repoOpen = openExecRepos[repoKey] || filtering
                                            const items = repoGroup.items.sort((a:any, b:any) => a.executableName.localeCompare(b.executableName))
                                            return <div key={repoGroup.repo} style={{ marginBottom: "2px" }}>
                                                <div
                                                    onClick={() => {
                                                        setOpenExecRepos({ ...openExecRepos, [repoKey]: !openExecRepos[repoKey] })
                                                        onNavigate({ panel: "executables", params: { executableType: group.type, executableRepo: repoGroup.repo, executableName: undefined } })
                                                    }}
                                                    title={repoGroup.repositoryPath}
                                                    className={`eco-nav-repo-title ${selection.executableType === group.type && selection.executableRepo === repoGroup.repo ? "active" : ""}`}>
                                                    <Icon name={repoOpen ? "caret down" : "caret right"} style={{ flex: "0 0 auto", margin: 0 }}/>
                                                    <Icon name="cubes" style={{ flex: "0 0 auto", margin: 0 }}/>
                                                    <span style={{ flex: "1 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{repoGroup.repo}</span>
                                                    <Label circular size="mini" style={{ flex: "0 0 auto", margin: 0 }}>{items.length}</Label>
                                                </div>
                                                {
                                                    repoOpen &&
                                                    <List selection size="small">
                                                        {
                                                            items.map((executable:any, key:number) =>
                                                                <List.Item
                                                                    key={key}
                                                                    active={selection.executableName === executable.executableName}
                                                                    onClick={() => onNavigate({ panel: "executables", params: { executableName: executable.executableName } })}>
                                                                    <List.Content>
                                                                        <List.Header style={{ paddingLeft: "14px", display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                                                                            <ExecutableIcon executable={executable} fallbackIcon={group.icon} serverManagerInformation={serverManagerInformation}/>
                                                                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{executable.executableName}</span>
                                                                            <Label size="mini" basic color={executable.isInstalled ? "green" : "grey"} style={{ marginLeft: "auto", flex: "0 0 auto" }}>
                                                                                {executable.isInstalled ? "in" : "out"}
                                                                            </Label>
                                                                        </List.Header>
                                                                    </List.Content>
                                                                </List.Item>)
                                                        }
                                                    </List>
                                                }
                                            </div>
                                        })
                                    }
                                </div>
                            }
                        </div>
                    })
                }
                <div onClick={() => setShowDebugExecutables(!showDebugExecutables)} className="eco-nav-debug-toggle">
                    <Icon name={showDebugExecutables ? "eye slash" : "eye"}/>
                    {showDebugExecutables ? "ocultar -dbg" : "mostrar -dbg"}
                </div>
            </Accordion.Content>

            { /* Environments — não lista (são muitos); abre um painel com a lista */ }
            <Accordion.Title
                active={isActivePanel("environments")}
                onClick={() => onNavigate({ panel: "environments", params: { environmentName: undefined } })}>
                <Icon name="dropdown" style={{ visibility: "hidden" }}/>
                <SectionTitle iconName="sitemap" label="Environments" count={environmentNameList.length}/>
            </Accordion.Title>

            { /* Repositories & Packages (repos/, sources.json) — lista de repos */ }
            <Accordion.Title
                active={openSections.repositories}
                onClick={() => { toggleSection("repositories"); onNavigate({ panel: "repositories", params: { tab: selection.tab || "packages" } }) }}>
                <Icon name="dropdown"/>
                <SectionTitle iconName="cubes" label="Repositories & Packages" count={repoNamespaceList.length}/>
            </Accordion.Title>
            <Accordion.Content active={openSections.repositories || filtering}>
                <List selection size="small">
                    {
                        filteredRepoNames.map((repositoryNamespace:string, key:number) =>
                            <List.Item
                                key={key}
                                active={selection.repo === repositoryNamespace}
                                onClick={() => onNavigate({ panel: "repositories", params: { repo: repositoryNamespace, tab: selection.tab || "packages" } })}>
                                <List.Content>
                                    <List.Header><Icon name="cubes"/> {repositoryNamespace}</List.Header>
                                </List.Content>
                            </List.Item>)
                    }
                </List>
            </Accordion.Content>

            { /* Config Files */ }
            <Accordion.Title
                active={openSections.configFiles}
                onClick={() => { toggleSection("configFiles"); onNavigate({ panel: "config files", params: { configFileName: undefined } }) }}>
                <Icon name="dropdown"/>
                <SectionTitle iconName="cogs" label="Config Files" count={configFileList.length}/>
            </Accordion.Title>
            <Accordion.Content active={openSections.configFiles || filtering}>
                <List selection size="small">
                    {
                        filteredConfigFiles.map((configFileName:string, key:number) =>
                            <List.Item
                                key={key}
                                active={selection.configFileName === configFileName}
                                onClick={() => onNavigate({ panel: "config files", params: { configFileName } })}>
                                <List.Content>
                                    <List.Header><Icon name="file alternate outline"/> {configFileName}</List.Header>
                                </List.Content>
                            </List.Item>)
                    }
                </List>
            </Accordion.Content>

        </Accordion>
    </div>
}

export default EcosystemNavigator
