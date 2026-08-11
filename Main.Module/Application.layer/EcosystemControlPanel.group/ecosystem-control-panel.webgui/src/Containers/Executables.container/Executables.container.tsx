import * as React from "react"
import { useState, useEffect } from "react"

import {
    Button,
    CheckboxInput,
    EmptyState,
    Icon,
    ObjectCard,
    PageMasthead,
    SearchInput,
    SkeletonCards,
    Spinner,
    StatusChip,
    StatusStrip
} from "@i-components"

import { GetAPI } from "@i-components/net"
import GetExecutableIconURL from "../../Utils/GetExecutableIconURL"
import ExecutableInformation from "./ExecutableInformation"

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
// A cor de acento e a do chip saíram do JS e viraram classes de produto
// (.ecp-exec-card--<kind> / .ecp-kind--<kind>), pintadas só com tokens --mp-*.
const GetExecutableKind = (e:any) => {
    const p = (e.packageRepoPath || "").toLowerCase()
    if(e.type === "cli" || p.endsWith(".cli")) return "cli"
    if(p.endsWith(".desktopapp")) return "desktop"
    return "app"
}

const ExecutableIcon = ({ executable, serverManagerInformation }:any) => {
    const iconURL = executable.hasPackageIcon
        ? GetExecutableIconURL({ serverManagerInformation, executableName: executable.executableName })
        : undefined

    if(iconURL)
        return <img className="ecp-exec-cardicon" src={iconURL} alt="" title="icone do pacote"/>

    return <Icon name={TYPE_ICON[executable.type] || "file"} tone="muted" title={executable.type}/>
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
        return <div className="ecp-exec-page ecp-exec-page--detail">
            <Button
                className="ecp-exec-back"
                variant="subtle"
                size="sm"
                icon="arrow left"
                onClick={onClearExecutable}>executables</Button>
            {
                isLoading
                ? <div className="ecp-exec-loading"><Spinner label="loading executable" size="lg"/></div>
                : <ExecutableInformation executableInformation={executableInformation} serverManagerInformation={serverManagerInformation} onInstall={handleInstall}/>
            }
        </div>

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

    return <div className="ecp-exec-page">
        <PageMasthead
            icon="terminal"
            title="Executables"
            subtitle="Install, filter and inspect the applications, daemons and CLIs declared by the repositories.">
            <StatusStrip right={<>
                <CheckboxInput label="show -dbg" checked={showDebug} onChange={() => setShowDebug(!showDebug)}/>
                <SearchInput
                    className="ecp-exec-search"
                    placeholder="filter..."
                    value={filterValue}
                    onValueChange={(value:string) => setFilterValue(value)}/>
            </>}>
                <StatusChip icon="terminal" count={totalCount} label="executables"/>
                <StatusChip icon="check circle" tone="success" count={installedCount} label="installed"/>
                <StatusChip icon="circle outline" count={notInstalledCount} label="not installed"/>
                { filterLabelList.length > 0 && <StatusChip icon="filter" tone="info" label={filterLabelList.join(" / ")}/> }
            </StatusStrip>
        </PageMasthead>

        <div className="ecp-exec-scroll">
        {
            isListLoading
            ? <SkeletonCards cards={8}/>
            : repoGroups.map((group:any) => {
                const items = group.items.sort((a:any, b:any) => {
                    if(a.isInstalled !== b.isInstalled) return a.isInstalled ? -1 : 1
                    return a.executableName.localeCompare(b.executableName)
                })
                return <div key={group.repo} className="ecp-exec-group">
                    <div className="ecp-exec-group__head" title={group.repositoryPath}>
                        <Icon name="cubes"/>
                        <span>{group.repo}</span>
                        <span className="ecp-count">{items.length}</span>
                    </div>
                    <div className="ecp-exec-grid">
                        {
                            items.map((executable:any, key:number) => {
                                const kind = GetExecutableKind(executable)
                                return <ObjectCard
                                    key={key}
                                    className={`ecp-exec-card ecp-exec-card--${kind}`}
                                    iconNode={<ExecutableIcon executable={executable} serverManagerInformation={serverManagerInformation}/>}
                                    title={executable.executableName}
                                    meta={PackageName(executable.packageRepoPath)}
                                    dim={!executable.isInstalled}
                                    selected={selectedExecutableName === executable.executableName}
                                    status={<span className={`ecp-flag ${executable.isInstalled ? "ecp-flag--ok" : ""}`.trim()}>
                                        {executable.isInstalled ? "installed" : "not installed"}
                                    </span>}
                                    chips={<>
                                        <span className={`ecp-kind ecp-kind--${kind}`}>{kind}</span>
                                        { executable.isDebug && <span className="mp-type-chip">dbg</span> }
                                    </>}
                                    onClick={() => onSelectExecutable(executable.executableName)}/>
                            })
                        }
                    </div>
                </div>
            })
        }
        { !isListLoading && visible.length === 0 && <EmptyState icon="filter" message="no executables match the filter"/> }
        </div>
    </div>
}

export default ExecutablesContainer
