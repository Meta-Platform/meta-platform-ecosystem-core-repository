import * as React from "react"
import { useEffect, useRef, useState } from "react"

import {
    Button,
    Checkbox,
    Header,
    Label,
    List,
    Modal,
    Segment,
    Tab,
    Table,
    Loader,
    Icon,
    Image
} from "semantic-ui-react"

import GetExecutableIconURL from "../../Utils/GetExecutableIconURL"
import EmptyState from "../../Components/EmptyState"
import KeyValuePanel from "../../Components/KeyValuePanel"
import CopyValue from "../../Components/CopyValue"
import { openExecWindow } from "../../Utils/logWindows"

// Cabeçalho de seção leve (evita o "icon header" do Semantic que amplia o ícone).
const SectionHeader = ({ icon, children }:any) =>
    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, fontSize: "1rem", color: "#3a4047", borderBottom: "1px solid #eef0f2", paddingBottom: "6px", margin: "16px 0 8px" }}>
        <Icon name={icon} style={{ fontSize: "1em", margin: 0 }}/> {children}
    </div>

const ExecutablePackageIcon = ({ executableInformation, serverManagerInformation, size = 26, fallbackIcon = "terminal" }:any) => {
    const iconURL = executableInformation?.hasPackageIcon
        ? GetExecutableIconURL({ serverManagerInformation, executableName: executableInformation.executableName })
        : undefined

    if(iconURL)
        return <Image src={iconURL} title="icone do pacote" style={{ width: `${size}px`, height: `${size}px`, objectFit: "contain", flex: "0 0 auto", margin: 0 }}/>

    return <Icon name={fallbackIcon}/>
}

// Barra de ações do executável. Por enquanto, apenas APP e DESKTOP podem ser
// disparados pela UI; CLI fica sem ação no detalhe.
const HostActionsBar = ({ executableInformation, onRun }:any) => {

    const [ confirmRun, setConfirmRun ]     = useState(false)

    const packageDirPath = executableInformation?.packageDirPath
    const appType = executableInformation?.appType
    const canRun = appType === "APP" || appType === "DESKTOP"

    if(!packageDirPath || !canRun) return null

    return <>
        <Button primary size="small" onClick={() => setConfirmRun(true)} style={{ flex: "0 0 auto" }}>
            <Icon name="play"/> executar
        </Button>
        {
            confirmRun &&
            <Modal size="small" open={true} onClose={() => setConfirmRun(false)}>
                <Modal.Header><Icon name="play" color="green"/> Executar {executableInformation.executableName}</Modal.Header>
                <Modal.Content>
                    Executar <code>{executableInformation.executableName}</code> via <code>run package</code>?
                    Isso inicia uma nova instância no ecossistema.
                </Modal.Content>
                <Modal.Actions>
                    <Button onClick={() => setConfirmRun(false)}>cancelar</Button>
                    <Button color="green" onClick={() => { setConfirmRun(false); onRun() }}>
                        <Icon name="play"/> executar
                    </Button>
                </Modal.Actions>
            </Modal>
        }
    </>
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
        <div style={{ marginLeft: depth * 16, marginBottom: "14px", borderLeft: depth > 0 ? "2px solid #eef0f2" : "none", paddingLeft: depth > 0 ? "12px" : 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{
                    flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "8px",
                    background: "#f3f4f6", border: "1px solid #e6e8eb", padding: "6px 10px", borderRadius: "6px",
                    fontFamily: "monospace", fontSize: ".88em", color: "#2d333a", overflow: "auto"
                }}>
                    <span style={{ color: "#aab1b9", flex: "0 0 auto" }}>$</span>
                    <span style={{ whiteSpace: "nowrap" }}>{prefix} <strong>{commandStr}</strong></span>
                </div>
                <CopyValue value={invocation}/>
            </div>
            { command.description && <div style={{ color: "#666", margin: "5px 0 0 2px", fontSize: ".92em" }}>{command.description}</div> }
            {
                parameters.length > 0 &&
                <div style={{ margin: "4px 0 0 2px" }}>
                    {
                        parameters.map((p:any, k:number) =>
                            <div key={k} style={{ fontSize: ".82em", color: "#8a9099", margin: "1px 0", wordBreak: "break-word" }}>
                                <span style={{ fontFamily: "monospace", color: "#586069" }}>{p.paramType === "positional" ? `[${p.key}]` : `--${p.key}`}</span>
                                <span style={{ margin: "0 6px", color: "#bbb" }}>{p.valueType}{p.paramType !== "positional" ? " · option" : ""}</span>
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

const ExecutableInformation = ({ executableInformation, serverManagerInformation }:any) => {

    if(!executableInformation)
        return <Segment placeholder style={{ minHeight: "200px" }}>
            <EmptyState
                icon="terminal"
                title="Nenhum executável selecionado"
                description="Selecione um executável na árvore Executables (sidebar) para ver seus detalhes e ações."/>
        </Segment>

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

    const infoPane = () => <Tab.Pane>
        <List relaxed size="small">
            <List.Item>
                <List.Icon verticalAlign="middle">
                    <ExecutablePackageIcon executableInformation={executableInformation} serverManagerInformation={serverManagerInformation} size={18} fallbackIcon="folder outline"/>
                </List.Icon>
                <List.Content>
                    <List.Header>package</List.Header>
                    <List.Description style={{ wordBreak: "break-all" }}>{packageRepoPath}</List.Description>
                </List.Content>
            </List.Item>
            <List.Item>
                <List.Icon name="cubes" verticalAlign="middle"/>
                <List.Content>
                    <List.Header>repository</List.Header>
                    <List.Description style={{ wordBreak: "break-all" }}>{repositoryPath}</List.Description>
                </List.Content>
            </List.Item>
            {
                (supervisorSocketPath || supervisorSocketFileName) && <List.Item>
                    <List.Icon name="plug" verticalAlign="middle"/>
                    <List.Content>
                        <List.Header>supervisor socket</List.Header>
                        <List.Description style={{ wordBreak: "break-all" }}>{supervisorSocketPath || supervisorSocketFileName}</List.Description>
                    </List.Content>
                </List.Item>
            }
            {
                packageMetadata && packageMetadata.version && <List.Item>
                    <List.Icon name="tag" verticalAlign="middle"/>
                    <List.Content>
                        <List.Header>version</List.Header>
                        <List.Description>{packageMetadata.version}</List.Description>
                    </List.Content>
                </List.Item>
            }
        </List>
        {
            startupParams && Object.keys(startupParams).length > 0 && <>
                <SectionHeader icon="sliders horizontal">Startup params ({Object.keys(startupParams).length})</SectionHeader>
                <KeyValuePanel data={startupParams}/>
            </>
        }
    </Tab.Pane>

    const panes:any[] = [
        { menuItem: { key: "info", content: <span><Icon name="info circle"/> info</span> }, render: infoPane }
    ]
    if(commandGroup && Array.isArray(commandGroup.commands))
        panes.push({
            menuItem: { key: "commands", content: <span><Icon name="terminal"/> commands ({commandGroup.commands.length})</span> },
            render: () => <Tab.Pane>
                <div style={{ marginTop: "4px" }}>
                    { commandGroup.commands.map((command:any, key:number) => <CommandRow key={key} command={command} prefix={executableName}/>) }
                </div>
            </Tab.Pane>
        })
    else if(boot)
        panes.push({
            menuItem: { key: "manifest", content: <span><Icon name="cubes"/> manifest</span> },
            render: () => <Tab.Pane><BootManifestView boot={boot}/></Tab.Pane>
        })

    return <Segment>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <Header style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                <ExecutablePackageIcon executableInformation={executableInformation} serverManagerInformation={serverManagerInformation} size={32}/>
                <Header.Content>
                    {executableName}
                    <Label size="tiny" color={type === "cli" ? "teal" : "blue"} style={{ marginLeft: "8px" }}>{type}</Label>
                    <Label size="tiny" basic color={isInstalled ? "green" : "grey"}>{isInstalled ? "installed" : "not installed"}</Label>
                    { isDebug && <Label size="tiny" color="grey">debug</Label> }
                </Header.Content>
            </Header>
            <HostActionsBar
                executableInformation={executableInformation}
                onRun={() => openExecWindow({ packageDirPath: executableInformation.packageDirPath, executableName })}/>
        </div>
        <Tab menu={{ secondary: true, pointing: true }} panes={panes} style={{ marginTop: "12px" }}/>
    </Segment>
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
                <List bulleted>
                    { executables.map((e:any, k:number) =>
                        <List.Item key={k}>{e.executableName} — <i style={{ color: "#888" }}>{e.dependency}</i></List.Item>) }
                </List>
            </>
        }
        {
            services.length > 0 && <>
                <SectionHeader icon="cogs">Services ({services.length})</SectionHeader>
                <List divided size="small">
                    { services.map((s:any, k:number) =>
                        <List.Item key={k}>
                            <List.Icon name="cog" verticalAlign="middle"/>
                            <List.Content>
                                <List.Header>{s.namespace}</List.Header>
                                <List.Description style={{ color: "#888", wordBreak: "break-all" }}>{s.dependency}</List.Description>
                            </List.Content>
                        </List.Item>) }
                </List>
            </>
        }
        {
            endpoints.length > 0 && <>
                <SectionHeader icon="plug">Endpoints ({endpoints.length})</SectionHeader>
                <List divided size="small">
                    { endpoints.map((e:any, k:number) =>
                        <List.Item key={k}>
                            <List.Icon name="linkify" verticalAlign="middle"/>
                            <List.Content>
                                <List.Header>{e.url || e.dependency}</List.Header>
                                { e.url && <List.Description style={{ color: "#888", wordBreak: "break-all" }}>{e.dependency}</List.Description> }
                            </List.Content>
                        </List.Item>) }
                </List>
            </>
        }
        {
            services.length === 0 && endpoints.length === 0 && executables.length === 0 &&
            <span style={{ color: "#bbb" }}>boot.json sem services/endpoints declarados</span>
        }
    </>
}

export default ExecutableInformation
