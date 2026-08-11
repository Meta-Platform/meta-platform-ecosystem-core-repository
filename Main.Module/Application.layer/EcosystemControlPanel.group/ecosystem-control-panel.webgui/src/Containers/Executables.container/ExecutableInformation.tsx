import * as React from "react"
import { useState } from "react"

import {
    Button,
    CopyableMonoText,
    EmptyState,
    EntityHeader,
    Icon,
    KeyValueList,
    ListRow,
    Tabs
} from "@i-components"

import GetExecutableIconURL from "../../Utils/GetExecutableIconURL"
import KeyValuePanel from "../../Components/KeyValuePanel"
import CopyValue from "../../Components/CopyValue"
import { toastSuccess, toastError, errorMessage } from "../../Utils/toast"

// Cabeçalho de seção leve (o kit não tem componente para isto; o Panel do kit é
// uma moldura completa e pesa demais dentro do painel de aba).
const SectionHeader = ({ icon, children }:any) =>
    <div className="ecp-section-head">
        <Icon name={icon}/> {children}
    </div>

const ExecutablePackageIcon = ({ executableInformation, serverManagerInformation, size = 26, fallbackIcon = "terminal" }:any) => {
    const iconURL = executableInformation?.hasPackageIcon
        ? GetExecutableIconURL({ serverManagerInformation, executableName: executableInformation.executableName })
        : undefined

    if(iconURL)
        return <img
            className="ecp-pkgicon"
            src={iconURL}
            alt=""
            title="icone do pacote"
            style={{ width: `${size}px`, height: `${size}px` }}/>

    return <Icon name={fallbackIcon}/>
}

// Exibe cada comando como ele é chamado na linha de comando:
//   $ executor package [path]
// + descrição e parâmetros, para o usuário saber como executar.
const CommandRow = ({ command, prefix, depth = 0 }:any) => {
    const children   = command.children || []
    const commandStr = command.command || command.namespace || ""
    const invocation = `${prefix} ${commandStr}`.trim()
    const parameters = command.parameters || []
    const childPrefix = `${prefix} ${commandStr.split(" ")[0]}`.trim()

    return <>
        <div
            className={`ecp-cmd ${depth > 0 ? "ecp-cmd--child" : ""}`.trim()}
            style={{ marginLeft: depth * 16 }}>
            <div className="ecp-cmd__line">
                <div className="ecp-cmd__invocation">
                    <span className="ecp-cmd__prompt">$</span>
                    <span className="ecp-cmd__text">{prefix} <strong>{commandStr}</strong></span>
                </div>
                <CopyValue value={invocation}/>
            </div>
            { command.description && <div className="ecp-cmd__description">{command.description}</div> }
            {
                parameters.length > 0 &&
                <div className="ecp-cmd__params">
                    {
                        parameters.map((p:any, k:number) =>
                            <div key={k} className="ecp-cmd__param">
                                <span className="ecp-cmd__paramkey">{p.paramType === "positional" ? `[${p.key}]` : `--${p.key}`}</span>
                                <span className="ecp-cmd__paramtype">{p.valueType}{p.paramType !== "positional" ? " · option" : ""}</span>
                                { p.describe && <span>— {p.describe}</span> }
                            </div>)
                    }
                </div>
            }
        </div>
        {
            children.map((child:any, key:number) =>
                <CommandRow key={key} command={child} prefix={childPrefix} depth={depth + 1}/>)
        }
    </>
}

const ExecutableInformation = ({ executableInformation, serverManagerInformation, onInstall }:any) => {

    const [ isInstalling, setIsInstalling ] = useState(false)
    // O Tabs do kit é só a barra: a aba ativa e o painel são desta tela.
    const [ activeTab, setActiveTab ] = useState("info")

    if(!executableInformation)
        return <div className="ecp-exec-empty">
            <EmptyState
                icon="terminal"
                title="No executable selected"
                message="Select an executable in the Executables tree (sidebar) to view its details and actions."/>
        </div>

    const {
        executableName,
        type,
        isDebug,
        isInstalled,
        packageRepoPath,
        repositoryPath,
        supervisorSocketPath,
        supervisorSocketFileName,
        commandGroup,
        boot,
        startupParams,
        package: packageMetadata
    } = executableInformation

    const infoPane = () => <>
        <KeyValueList items={[
            { label: "package", value: <CopyableMonoText value={packageRepoPath} maxChars={64}/> },
            { label: "repository", value: <CopyableMonoText value={repositoryPath} maxChars={64}/> },
            (supervisorSocketPath || supervisorSocketFileName)
                ? { label: "supervisor socket", value: <CopyableMonoText value={supervisorSocketPath || supervisorSocketFileName} maxChars={64}/> }
                : undefined,
            (packageMetadata && packageMetadata.version)
                ? { label: "version", value: packageMetadata.version, mono: true }
                : undefined
        ].filter(Boolean)}/>
        {
            startupParams && Object.keys(startupParams).length > 0 && <>
                <SectionHeader icon="sliders horizontal">Startup params ({Object.keys(startupParams).length})</SectionHeader>
                <KeyValuePanel data={startupParams}/>
            </>
        }
    </>

    const hasCommands = !!(commandGroup && Array.isArray(commandGroup.commands))

    const tabs:any[] = [ { key: "info", label: "info", icon: "info circle" } ]
    if(hasCommands)
        tabs.push({ key: "commands", label: "commands", icon: "terminal", count: commandGroup.commands.length })
    else if(boot)
        tabs.push({ key: "manifest", label: "manifest", icon: "cubes" })

    // Trocar de executável pode deixar `activeTab` apontando para uma aba que
    // não existe mais — cai para "info" sem perder o estado do usuário.
    const currentTab = tabs.some((tab:any) => tab.key === activeTab) ? activeTab : "info"

    const renderPane = () => {
        if(currentTab === "commands")
            return <div className="ecp-cmd-list">
                { commandGroup.commands.map((command:any, key:number) => <CommandRow key={key} command={command} prefix={executableName}/>) }
            </div>
        if(currentTab === "manifest")
            return <BootManifestView boot={boot}/>
        return infoPane()
    }

    return <div className="ecp-exec-detailbox">
        <EntityHeader
            className="ecp-exec-entityheader"
            iconNode={<ExecutablePackageIcon executableInformation={executableInformation} serverManagerInformation={serverManagerInformation} size={28}/>}
            title={executableName}
            subtitle={packageRepoPath}
            typeLabel={type}
            badges={<>
                <span className={`ecp-flag ${isInstalled ? "ecp-flag--ok" : ""}`.trim()}>{isInstalled ? "installed" : "not installed"}</span>
                { isDebug && <span className="mp-type-chip">debug</span> }
            </>}
            meta={packageMetadata && packageMetadata.version ? [{ label: "version", value: packageMetadata.version }] : []}
            technicalRef={{ label: "repository", value: repositoryPath }}
            actions={
                !isInstalled && onInstall &&
                <Button
                    variant="primary"
                    size="sm"
                    icon="download"
                    loading={isInstalling}
                    onClick={async () => {
                        setIsInstalling(true)
                        try {
                            await onInstall(executableName)
                            toastSuccess(`Executable ${executableName} installed.`)
                        } catch(e) {
                            toastError(errorMessage(e))
                        } finally {
                            setIsInstalling(false)
                        }
                    }}>install</Button>
            }/>
        <Tabs className="ecp-exec-tabs" tabs={tabs} activeKey={currentTab} onChange={setActiveTab}/>
        <div className="ecp-tabpanel">{renderPane()}</div>
    </div>
}

// Visualiza o que o pacote expõe a partir do boot.json (aprendido com o
// PackageDeveloper: mostrar o interior do pacote por tipo). Para apps/web:
// params, services e endpoints; para CLI: executáveis declarados.
const BootManifestView = ({ boot }:any) => {
    const services  = Array.isArray(boot.services) ? boot.services : []
    const endpoints = Array.isArray(boot.endpoints) ? boot.endpoints : []
    const executables = Array.isArray(boot.executables) ? boot.executables : []

    return <>
        {
            executables.length > 0 && <>
                <SectionHeader icon="terminal">Executables ({executables.length})</SectionHeader>
                { executables.map((e:any, k:number) =>
                    <ListRow key={k} icon="terminal" title={e.executableName} meta={e.dependency}/>) }
            </>
        }
        {
            services.length > 0 && <>
                <SectionHeader icon="cogs">Services ({services.length})</SectionHeader>
                { services.map((s:any, k:number) =>
                    <ListRow key={k} icon="cog" title={s.namespace} meta={s.dependency}/>) }
            </>
        }
        {
            endpoints.length > 0 && <>
                <SectionHeader icon="plug">Endpoints ({endpoints.length})</SectionHeader>
                { endpoints.map((e:any, k:number) =>
                    <ListRow key={k} icon="linkify" title={e.url || e.dependency} meta={e.url ? e.dependency : undefined}/>) }
            </>
        }
        {
            services.length === 0 && endpoints.length === 0 && executables.length === 0 &&
            <span className="ecp-manifest-empty">boot.json sem services/endpoints declarados</span>
        }
    </>
}

export default ExecutableInformation
