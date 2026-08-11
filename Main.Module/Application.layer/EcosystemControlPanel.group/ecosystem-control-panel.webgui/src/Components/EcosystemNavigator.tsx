import * as React from "react"
import { useState, useEffect } from "react"

import {
    Button,
    Icon,
    SearchInput,
    SidePanel,
    Spinner,
    TreeRow,
    GetStatusTone
} from "@i-components"

import GetAPI       from "../Utils/GetAPI"
import useWebSocket from "../Hooks/useWebSocket"
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

// O vocabulário de status do kit inclui "done", que não é um tom de ícone;
// nos sockets ele nunca aparece, mas o mapa protege o caso.
const StatusIconTone = (status:string):any => {
    const tone = GetStatusTone(status)
    return tone === "done" ? "muted" : tone
}

const ExecutableIcon = ({ executable, fallbackIcon, serverManagerInformation }:any) => {
    const iconURL = executable.hasPackageIcon
        ? GetExecutableIconURL({ serverManagerInformation, executableName: executable.executableName })
        : undefined

    if(iconURL)
        return <img
            src={iconURL}
            alt=""
            title="icone do pacote"
            className="ecp-nav-leaf__img"/>

    return <Icon name={fallbackIcon} tone="muted"/>
}

const GroupEnvironmentsByPackageIdentity = (environmentNameList:string[]) =>
    environmentNameList.reduce((groups:any, environmentName:string) => {
        const identity = ExtractPackageIdentity(environmentName)
        if(!groups[identity])
            groups[identity] = []
        groups[identity].push(environmentName)
        return groups
    }, {})

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

    // Cada seção mantém o comportamento antigo do Accordion.Title: um clique
    // abre/fecha E navega. Com o TreeRow do kit a seta e o rótulo são botões
    // distintos, então ambos recebem o MESMO handler.
    const _OpenSockets = () => {
        toggleSection("sockets")
        onNavigate({ panel: "instance supervisor", params: { monitoringStateKey: undefined } })
    }
    const _OpenExecutables = () => {
        toggleSection("executables")
        onNavigate({ panel: "executables", params: { executableName: undefined, executableType: undefined, executableRepo: undefined, executableStatus: undefined } })
    }
    const _OpenRepositories = () => {
        toggleSection("repositories")
        onNavigate({ panel: "repositories", params: { tab: selection.tab || "packages" } })
    }
    const _OpenConfigFiles = () => {
        toggleSection("configFiles")
        onNavigate({ panel: "config files", params: { configFileName: undefined } })
    }

    return <SidePanel className="ecp-navigator">

        <div className="ecp-nav-search">
            <SearchInput
                value={navFilter}
                onValueChange={setNavFilter}
                placeholder="search..."/>
        </div>

        { isLoading && <div className="ecp-nav-loading"><Spinner label="loading ecosystem…"/></div> }

        <div className="ecp-nav-tree">

            { /* Sockets — clique abre o Overview e lista os sockets */ }
            <TreeRow
                icon="server"
                label="Supervisor Sockets"
                meta={visibleOverviewKeys.length}
                hasChildren
                expanded={openSections.sockets || filtering}
                selected={isActivePanel("instance supervisor") && !selection.monitoringStateKey}
                onToggle={_OpenSockets}
                onSelect={_OpenSockets}/>
            {
                (openSections.sockets || filtering) &&
                <div className="ecp-nav-children">
                    {
                        overviewSocketGroupList.map((group:any) =>
                            <div key={group.groupKey} className="ecp-nav-block">
                                <div className="ecp-nav-group">{group.groupLabel}</div>
                                {
                                    group.items.map((monitoringStateKey:string, key:number) => {
                                        const info = overview[monitoringStateKey] || {}
                                        const socketName = GetSocketName(info.filePath) || ShortHash(monitoringStateKey)
                                        return <TreeRow
                                            key={key}
                                            depth={1}
                                            selected={selection.monitoringStateKey === monitoringStateKey}
                                            onSelect={() => onNavigate({ panel: "instance supervisor", params: { monitoringStateKey } })}
                                            label={
                                                <span className="ecp-nav-leaf">
                                                    <Icon name="plug" size="small" tone={StatusIconTone(info.status)}/>
                                                    <span className="ecp-nav-leaf__name" title={monitoringStateKey}>{socketName}</span>
                                                    {
                                                        logKeys.includes(monitoringStateKey) &&
                                                        <Icon name="terminal" size="small" tone="info" className="ecp-log-live" title="log stream ao vivo"/>
                                                    }
                                                </span>
                                            }/>
                                    })
                                }
                            </div>)
                    }
                    { hiddenUnavailableCount > 0 && <div className="ecp-nav-note">{hiddenUnavailableCount} unavailable sockets hidden</div> }
                </div>
            }

            { /* Executables (executables/) — 2º nó, irmão de repos/ no EcosystemData */ }
            <TreeRow
                icon="terminal"
                label="Executables"
                meta={executableList.filter((e:any) => !IsIgnoredExecutable(e.executableName) && !e.isDebug).length}
                hasChildren
                expanded={openSections.executables || filtering}
                selected={isActivePanel("executables") && !selection.executableType && !selection.executableName}
                onToggle={_OpenExecutables}
                onSelect={_OpenExecutables}/>
            {
                (openSections.executables || filtering) &&
                <div className="ecp-nav-children">
                    {
                        execTypeGroups.map((group:any) => {
                            if(group.items.length === 0) return null
                            const typeOpen = openExecGroups[group.type] || filtering
                            const _OpenType = () => {
                                setOpenExecGroups({ ...openExecGroups, [group.type]: !openExecGroups[group.type] })
                                onNavigate({ panel: "executables", params: { executableType: group.type, executableRepo: undefined, executableName: undefined } })
                            }
                            return <div key={group.type} className="ecp-nav-block">
                                <TreeRow
                                    depth={1}
                                    icon={group.icon}
                                    label={group.label}
                                    meta={group.items.length}
                                    hasChildren
                                    expanded={typeOpen}
                                    selected={selection.executableType === group.type && !selection.executableRepo}
                                    onToggle={_OpenType}
                                    onSelect={_OpenType}/>
                                {
                                    typeOpen &&
                                    group.repoGroups.map((repoGroup:any) => {
                                        const repoKey = `${group.type}::${repoGroup.repo}`
                                        const repoOpen = openExecRepos[repoKey] || filtering
                                        const items = repoGroup.items.sort((a:any, b:any) => a.executableName.localeCompare(b.executableName))
                                        const _OpenRepo = () => {
                                            setOpenExecRepos({ ...openExecRepos, [repoKey]: !openExecRepos[repoKey] })
                                            onNavigate({ panel: "executables", params: { executableType: group.type, executableRepo: repoGroup.repo, executableName: undefined } })
                                        }
                                        return <div key={repoGroup.repo}>
                                            <TreeRow
                                                depth={2}
                                                icon="cubes"
                                                label={<span title={repoGroup.repositoryPath}>{repoGroup.repo}</span>}
                                                meta={items.length}
                                                hasChildren
                                                expanded={repoOpen}
                                                selected={selection.executableType === group.type && selection.executableRepo === repoGroup.repo}
                                                onToggle={_OpenRepo}
                                                onSelect={_OpenRepo}/>
                                            {
                                                repoOpen &&
                                                items.map((executable:any, key:number) =>
                                                    <TreeRow
                                                        key={key}
                                                        depth={3}
                                                        selected={selection.executableName === executable.executableName}
                                                        onSelect={() => onNavigate({ panel: "executables", params: { executableName: executable.executableName } })}
                                                        label={
                                                            <span className="ecp-nav-leaf">
                                                                <ExecutableIcon executable={executable} fallbackIcon={group.icon} serverManagerInformation={serverManagerInformation}/>
                                                                <span className="ecp-nav-leaf__name">{executable.executableName}</span>
                                                            </span>
                                                        }
                                                        meta={
                                                            <span className={`mp-type-chip ecp-nav-chip ecp-nav-chip--${executable.isInstalled ? "in" : "out"}`}>
                                                                {executable.isInstalled ? "in" : "out"}
                                                            </span>
                                                        }/>)
                                            }
                                        </div>
                                    })
                                }
                            </div>
                        })
                    }
                    <Button
                        variant="subtle"
                        size="sm"
                        className="ecp-nav-debug-toggle"
                        icon={showDebugExecutables ? "eye slash" : "eye"}
                        onClick={() => setShowDebugExecutables(!showDebugExecutables)}>
                        {showDebugExecutables ? "hide -dbg" : "show -dbg"}
                    </Button>
                </div>
            }

            { /* Environments — não lista (são muitos); abre um painel com a lista */ }
            <TreeRow
                icon="sitemap"
                label="Environments"
                meta={environmentNameList.length}
                selected={isActivePanel("environments")}
                onSelect={() => onNavigate({ panel: "environments", params: { environmentName: undefined } })}/>

            { /* Repositories & Packages (repos/, sources.json) — lista de repos */ }
            <TreeRow
                icon="cubes"
                label="Repositories & Packages"
                meta={repoNamespaceList.length}
                hasChildren
                expanded={openSections.repositories || filtering}
                selected={isActivePanel("repositories") && !selection.repo}
                onToggle={_OpenRepositories}
                onSelect={_OpenRepositories}/>
            {
                (openSections.repositories || filtering) &&
                <div className="ecp-nav-children">
                    {
                        filteredRepoNames.map((repositoryNamespace:string, key:number) =>
                            <TreeRow
                                key={key}
                                depth={1}
                                icon="cubes"
                                label={repositoryNamespace}
                                selected={selection.repo === repositoryNamespace}
                                onSelect={() => onNavigate({ panel: "repositories", params: { repo: repositoryNamespace, tab: selection.tab || "packages" } })}/>)
                    }
                </div>
            }

            { /* Config Files */ }
            <TreeRow
                icon="cogs"
                label="Config Files"
                meta={configFileList.length}
                hasChildren
                expanded={openSections.configFiles || filtering}
                selected={isActivePanel("config files") && !selection.configFileName}
                onToggle={_OpenConfigFiles}
                onSelect={_OpenConfigFiles}/>
            {
                (openSections.configFiles || filtering) &&
                <div className="ecp-nav-children">
                    {
                        filteredConfigFiles.map((configFileName:string, key:number) =>
                            <TreeRow
                                key={key}
                                depth={1}
                                icon="file alternate outline"
                                label={configFileName}
                                selected={selection.configFileName === configFileName}
                                onSelect={() => onNavigate({ panel: "config files", params: { configFileName } })}/>)
                    }
                </div>
            }

            { /* Logs — o histórico do ecossistema. A árvore de arquivos vive
                 dentro do próprio painel, porque ela vem do backend e muda a
                 cada execução; aqui fica só a porta de entrada. */ }
            <TreeRow
                icon="file alternate outline"
                label="Logs"
                selected={isActivePanel("logs")}
                onSelect={() => onNavigate({ panel: "logs" })}/>

        </div>
    </SidePanel>
}

export default EcosystemNavigator
