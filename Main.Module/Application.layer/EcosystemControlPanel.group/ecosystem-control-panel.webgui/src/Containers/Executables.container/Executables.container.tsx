import * as React from "react"
import { useState, useEffect } from "react"

import { Button, Checkbox, Icon, Image, Input, Label, Loader, Segment } from "semantic-ui-react"

import GetAPI from "../../Utils/GetAPI"
import GetExecutableIconURL from "../../Utils/GetExecutableIconURL"
import ListSkeleton from "../../Components/Skeleton"
import ExecutableInformation from "./ExecutableInformation"
import PageMasthead from "../../Components/ui/PageMasthead"
import StatusStrip, { StatusChip } from "../../Components/ui/StatusStrip"
import ObjectCard from "../../Components/ui/ObjectCard"

// Executável de baixo nível interno do ecossistema — não deve aparecer no painel.
const IGNORED_EXECUTABLES = ["execute-application", "execute-command-line-application", "execute-desktop-application"]
// também ignora os correspondentes -dbg
const IsIgnoredExecutable = (executableName:string) => IGNORED_EXECUTABLES.includes(executableName.replace(/-dbg$/, ""))

// ícone por tipo de executável (cada card mantém a pista do seu tipo)
const TYPE_ICON:any = { cli: "terminal", application: "desktop" }

// nome curto do repositório a partir do caminho completo (REPOSITORY_PATH)
const RepoName = (repositoryPath:string) => {
    if(!repositoryPath) return "—"
    return repositoryPath.split("/").filter(Boolean).pop() || repositoryPath
}

// nome do pacote que provê o executável = último segmento do PACKAGE_REPO_PATH
const PackageName = (packageRepoPath:string) => {
    if(!packageRepoPath) return ""
    return packageRepoPath.split("/").filter(Boolean).pop() || ""
}

// Tipo visual do executável para colorir o card: cli | app | desktop.
const GetExecutableKind = (e:any) => {
    const p = (e.packageRepoPath || "").toLowerCase()
    if(e.type === "cli" || p.endsWith(".cli")) return "cli"
    if(p.endsWith(".desktopapp")) return "desktop"
    return "app"
}
const KIND_ACCENT:any      = { cli: "var(--mp-accent-cyan)", app: "var(--mp-accent-blue)", desktop: "var(--mp-accent-violet)" }
const KIND_LABEL_COLOR:any = { cli: "teal", app: "blue", desktop: "violet" }

const ExecutableIcon = ({ executable, serverManagerInformation }:any) => {
    const iconURL = executable.hasPackageIcon
        ? GetExecutableIconURL({ serverManagerInformation, executableName: executable.executableName })
        : undefined

    if(iconURL)
        return <Image src={iconURL} title="icone do pacote" style={{ width: "22px", height: "22px", objectFit: "contain", flex: "0 0 auto", margin: 0 }}/>

    return <Icon name={TYPE_ICON[executable.type] || "file"} style={{ color: "var(--mp-muted)" }} title={executable.type}/>
}

const ExecutablesContainer = ({
    serverManagerInformation,
    selectedExecutableName,
    selectedExecutableType,
    selectedExecutableRepo,
    selectedExecutableStatus,
    onSelectExecutable,
    onClearExecutable
}:any) => {

    const [ executableList, setExecutableList ]               = useState<any[]>([])
    const [ isListLoading, setIsListLoading ]                 = useState(true)
    const [ executableInformation, setExecutableInformation ] = useState<any>()
    const [ isLoading, setIsLoading ]                         = useState(false)
    const [ showDebug, setShowDebug ]                         = useState(false)
    const [ filterValue, setFilterValue ]                    = useState<string>("")

    const _GetExecutablesAPI = () =>
        GetAPI({ apiName: "Executables", serverManagerInformation })

    useEffect(() => { fetchExecutableList() }, [])

    useEffect(() => {
        if(selectedExecutableName) fetchExecutableInformation()
        else setExecutableInformation(undefined)
    }, [selectedExecutableName])

    const fetchExecutableList = async () => {
        try { setExecutableList((await _GetExecutablesAPI().ListExecutables()).data) }
        catch(e){ console.log(e) } finally { setIsListLoading(false) }
    }

    const fetchExecutableInformation = async () => {
        try {
            setIsLoading(true); setExecutableInformation(undefined)
            const response = await _GetExecutablesAPI().GetExecutableInformation({ executableName: selectedExecutableName })
            setExecutableInformation(response.data)
        } catch(e){ console.log(e) } finally { setIsLoading(false) }
    }

    // Instala um executável declarado (não instalado) e atualiza detalhe + lista.
    const handleInstall = async (executableName:string) => {
        await _GetExecutablesAPI().InstallExecutable({ executableName })
        await Promise.all([ fetchExecutableInformation(), fetchExecutableList() ])
    }

    // ---- DETALHE ----
    if(selectedExecutableName)
        return <Segment style={{ margin: "15px" }}>
            <Button size="small" basic icon labelPosition="left" onClick={onClearExecutable} style={{ marginBottom: "8px" }}>
                <Icon name="arrow left"/> executables
            </Button>
            {
                isLoading
                ? <Loader active style={{ margin: "50px" }}/>
                : <ExecutableInformation executableInformation={executableInformation} serverManagerInformation={serverManagerInformation} onInstall={handleInstall}/>
            }
        </Segment>

    // ---- GRADE DE CARDS (agrupada por repositório) ----
    const visible = executableList.filter((e:any) =>
        !IsIgnoredExecutable(e.executableName) &&
        (showDebug || !e.isDebug) &&
        (!selectedExecutableType || e.type === selectedExecutableType) &&
        (!selectedExecutableRepo || RepoName(e.repositoryPath) === selectedExecutableRepo) &&
        (!selectedExecutableStatus || (selectedExecutableStatus === "installed" ? e.isInstalled : !e.isInstalled)) &&
        (!filterValue || `${e.executableName} ${e.type} ${RepoName(e.repositoryPath)}`.toLowerCase().includes(filterValue.toLowerCase())))

    // agrupa os executáveis pelo repositório a que pertencem
    const groupsByRepo:any = {}
    visible.forEach((e:any) => {
        const repo = RepoName(e.repositoryPath)
        if(!groupsByRepo[repo]) groupsByRepo[repo] = { repo, repositoryPath: e.repositoryPath, items: [] }
        groupsByRepo[repo].items.push(e)
    })
    const repoGroups = Object.values(groupsByRepo).sort((a:any, b:any) => a.repo.localeCompare(b.repo))

    const filteredBaseList = executableList.filter((e:any) => !IsIgnoredExecutable(e.executableName) && !e.isDebug)
    const totalCount = filteredBaseList.length
    const installedCount = filteredBaseList.filter((e:any) => e.isInstalled).length
    const notInstalledCount = filteredBaseList.filter((e:any) => !e.isInstalled).length

    const filterLabelList = [
        selectedExecutableType && (selectedExecutableType === "cli" ? "Command Line" : "Application / Daemon"),
        selectedExecutableRepo,
        selectedExecutableStatus === "installed" ? "installed" : selectedExecutableStatus === "not-installed" ? "not installed" : undefined
    ].filter(Boolean)

    return <Segment style={{ margin: "10px", height: "calc(100vh - 110px)", display: "flex", flexDirection: "column" }}>
        <PageMasthead
            icon="terminal"
            title="Executables"
            subtitle="Install, filter and inspect the applications, daemons and CLIs declared by the repositories.">
            <StatusStrip right={<>
                <Checkbox toggle label="show -dbg" checked={showDebug} onChange={() => setShowDebug(!showDebug)}/>
                <Input icon="search" size="small" placeholder="filter..." value={filterValue}
                    onChange={(e, { value }) => setFilterValue(value)}/>
            </>}>
                <StatusChip icon="terminal" count={totalCount} label="executables"/>
                <StatusChip icon="check circle" tone="success" count={installedCount} label="installed"/>
                <StatusChip icon="circle outline" count={notInstalledCount} label="not installed"/>
                { filterLabelList.length > 0 && <StatusChip icon="filter" tone="info" label={filterLabelList.join(" / ")}/> }
            </StatusStrip>
        </PageMasthead>

        <div style={{ flex: "1 1 auto", minHeight: 0, overflow: "auto" }}>
        {
            isListLoading
            ? <ListSkeleton variant="cards" lines={8}/>
            : repoGroups.map((group:any) => {
                const items = group.items.sort((a:any, b:any) => {
                    if(a.isInstalled !== b.isInstalled) return a.isInstalled ? -1 : 1
                    return a.executableName.localeCompare(b.executableName)
                })
                return <div key={group.repo} style={{ marginBottom: "16px" }}>
                    <div style={{ color: "var(--mp-muted)", fontSize: ".8em", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".03em", marginBottom: "6px" }} title={group.repositoryPath}>
                        <Icon name="cubes"/> {group.repo} <Label circular size="mini">{items.length}</Label>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "12px" }}>
                        {
                            items.map((executable:any, key:number) => {
                                const kind = GetExecutableKind(executable)
                                return <ObjectCard
                                    key={key}
                                    iconNode={<ExecutableIcon executable={executable} serverManagerInformation={serverManagerInformation}/>}
                                    title={executable.executableName}
                                    meta={PackageName(executable.packageRepoPath)}
                                    dim={!executable.isInstalled}
                                    accent={KIND_ACCENT[kind]}
                                    selected={selectedExecutableName === executable.executableName}
                                    status={<Label size="mini" basic color={executable.isInstalled ? "green" : "grey"}>{executable.isInstalled ? "installed" : "not installed"}</Label>}
                                    chips={<>
                                        <Label size="mini" basic color={KIND_LABEL_COLOR[kind]}>{kind}</Label>
                                        { executable.isDebug && <Label size="mini" color="grey">dbg</Label> }
                                    </>}
                                    onClick={() => onSelectExecutable(executable.executableName)}/>
                            })
                        }
                    </div>
                </div>
            })
        }
        { !isListLoading && visible.length === 0 && <div style={{ color: "var(--mp-muted)", padding: "16px" }}>no executables match the filter</div> }
        </div>
    </Segment>
}

export default ExecutablesContainer
