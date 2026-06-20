import * as React from "react"
import { useState, useEffect } from "react"

import {
    Accordion,
    Icon,
    Input,
    List,
    Label,
    Loader
} from "semantic-ui-react"

import GetAPI       from "../Utils/GetAPI"
import useWebSocket from "../Hooks/useWebSocket"
import { GetStatusColor } from "./StatusBadge"

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

// Nome legível da instância a partir do caminho do socket de supervisão
// (ex.: .../supervisor-sockets/eco-panel.sock -> "eco-panel").
const GetSocketName = (filePath:string) => {
    if(!filePath) return ""
    const base = filePath.split("/").pop() || filePath
    return base.replace(/\.sock$/, "")
}

const GroupEnvironmentsByPackageIdentity = (environmentNameList:string[]) =>
    environmentNameList.reduce((groups:any, environmentName:string) => {
        const identity = ExtractPackageIdentity(environmentName)
        if(!groups[identity])
            groups[identity] = []
        groups[identity].push(environmentName)
        return groups
    }, {})

const SectionTitle = ({ iconName, label, count }:any) =>
    <span>
        <Icon name={iconName}/>
        <strong>{label}</strong>
        { count !== undefined && <Label circular size="mini" style={{ marginLeft: "6px" }}>{count}</Label> }
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

    const [ openSections, setOpenSections ] = useState<any>({ instances: true, environments: false })
    const [ openGroups, setOpenGroups ]     = useState<any>({})
    const [ openExecGroups, setOpenExecGroups ] = useState<any>({})
    const [ navFilter, setNavFilter ]       = useState<string>("")

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
    const filteredExecutables = executableList
        .filter((e:any) => (showDebugExecutables || !e.isDebug) && matchNav(`${e.executableName} ${e.type}`))
    const filteredEnvNames = environmentNameList.filter((n:string) => matchNav(n))
    const groupedEnvironments = GroupEnvironmentsByPackageIdentity(filteredEnvNames)
    const filteredRepoNames = repoNamespaceList.filter((n:string) => matchNav(n))
    const filteredConfigFiles = configFileList.filter((n:string) => matchNav(n))

    return <div className="eco-navigator" style={{ padding: "2px" }}>

        { isLoading && <Loader active inline="centered" size="small" style={{ margin: "20px" }}/> }

        <Input
            icon="search"
            size="small"
            fluid
            placeholder="buscar..."
            value={navFilter}
            onChange={(e, { value }) => setNavFilter(value)}
            style={{ marginBottom: "6px" }}/>

        <Accordion fluid styled style={{ fontSize: ".95em" }}>

            { /* Instances (supervisor sockets) */ }
            <Accordion.Title
                active={openSections.instances}
                onClick={() => toggleSection("instances")}>
                <Icon name="dropdown"/>
                <SectionTitle iconName="server" label="Instances" count={Object.keys(overview).length}/>
            </Accordion.Title>
            <Accordion.Content active={openSections.instances || filtering}>
                <List selection size="small">
                    <List.Item
                        active={isActivePanel("instance supervisor") && !selection.monitoringStateKey}
                        onClick={() => onNavigate({ panel: "instance supervisor", params: { monitoringStateKey: undefined } })}>
                        <List.Content>
                            <List.Header><Icon name="th"/> overview</List.Header>
                        </List.Content>
                    </List.Item>
                    {
                        filteredOverviewKeys.map((monitoringStateKey:string, key:number) => {
                            const info = overview[monitoringStateKey] || {}
                            const socketName = GetSocketName(info.filePath) || ShortHash(monitoringStateKey)
                            return <List.Item
                                key={key}
                                active={selection.monitoringStateKey === monitoringStateKey}
                                onClick={() => onNavigate({ panel: "instance supervisor", params: { monitoringStateKey } })}>
                                <List.Content>
                                    <Icon name="plug" size="small" color={GetStatusColor(info.status)}/>
                                    <span title={monitoringStateKey}>{socketName}</span>
                                </List.Content>
                            </List.Item>
                        })
                    }
                </List>
            </Accordion.Content>

            { /* Executables (executables/) — 2º nó, irmão de repos/ no EcosystemData */ }
            <Accordion.Title
                active={openSections.executables}
                onClick={() => { toggleSection("executables"); onNavigate({ panel: "executables", params: { executableName: undefined } }) }}>
                <Icon name="dropdown"/>
                <SectionTitle iconName="terminal" label="Executables"
                    count={executableList.filter((e:any) => !e.isDebug).length}/>
            </Accordion.Title>
            <Accordion.Content active={openSections.executables || filtering}>
                {
                    [
                        { type: "application", label: "Application / Daemon", icon: "desktop"  },
                        { type: "cli",         label: "Command Line",        icon: "terminal" }
                    ].map((group:any) => {
                        const items = filteredExecutables
                            .filter((e:any) => e.type === group.type)
                            .sort((a:any, b:any) => a.executableName.localeCompare(b.executableName))
                        if(items.length === 0) return null
                        const isOpen = openExecGroups[group.type] || filtering
                        return <div key={group.type} style={{ marginBottom: "4px" }}>
                            <div
                                onClick={() => setOpenExecGroups({ ...openExecGroups, [group.type]: !openExecGroups[group.type] })}
                                style={{ padding: "4px 6px 2px", color: "#8a9099", fontSize: ".75em", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".03em", cursor: "pointer", userSelect: "none" }}>
                                <Icon name={isOpen ? "caret down" : "caret right"}/>
                                <Icon name={group.icon}/> {group.label}
                                <Label circular size="mini" style={{ marginLeft: "5px" }}>{items.length}</Label>
                            </div>
                            {
                                isOpen &&
                                <List selection size="small">
                                    {
                                        items.map((executable:any, key:number) =>
                                            <List.Item
                                                key={key}
                                                active={selection.executableName === executable.executableName}
                                                onClick={() => onNavigate({ panel: "executables", params: { executableName: executable.executableName } })}>
                                                <List.Content>
                                                    <List.Header style={{ paddingLeft: "14px" }}><Icon name={group.icon}/> {executable.executableName}</List.Header>
                                                </List.Content>
                                            </List.Item>)
                                    }
                                </List>
                            }
                        </div>
                    })
                }
                <div onClick={() => setShowDebugExecutables(!showDebugExecutables)} style={{ cursor: "pointer", padding: "4px 6px", color: "#999", fontSize: ".85em" }}>
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
