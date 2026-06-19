import * as React from "react"
import { useState } from "react"

import {
    Button,
    Header,
    Label,
    List,
    Modal,
    Segment,
    Table,
    Loader,
    Icon
} from "semantic-ui-react"

import GetAPI from "../../Utils/GetAPI"
import EmptyState from "../../Components/EmptyState"
import { toastSuccess, toastError, errorMessage } from "../../Utils/toast"

// Barra de ações de host para o pacote do executável: executar, abrir VSCode
// e abrir terminal no diretório do pacote.
const HostActionsBar = ({ serverManagerInformation, packageDirPath }:any) => {

    const [ busy, setBusy ]                 = useState<string>()
    const [ confirmRun, setConfirmRun ]     = useState(false)

    const _GetAPI = () => GetAPI({ apiName: "HostActions", serverManagerInformation })

    const ACTION_MSG:any = { run: "Execução iniciada", vscode: "Abrindo VSCode", terminal: "Abrindo terminal" }
    const run = async (action:string, call:any) => {
        try { setBusy(action); await call(); toastSuccess(ACTION_MSG[action] || "ok") }
        catch(e) { toastError(errorMessage(e)) }
        finally { setBusy(undefined) }
    }

    if(!packageDirPath) return null

    return <>
        <Button.Group size="small" style={{ marginTop: "8px" }}>
            <Button primary loading={busy === "run"} onClick={() => setConfirmRun(true)}>
                <Icon name="play"/> run
            </Button>
            <Button loading={busy === "vscode"} onClick={() => run("vscode", () => _GetAPI().OpenVSCode({ targetPath: packageDirPath }))}>
                <Icon name="code"/> vscode
            </Button>
            <Button loading={busy === "terminal"} onClick={() => run("terminal", () => _GetAPI().OpenTerminal({ targetPath: packageDirPath }))}>
                <Icon name="terminal"/> terminal
            </Button>
        </Button.Group>
        {
            confirmRun &&
            <Modal size="small" open={true} onClose={() => setConfirmRun(false)}>
                <Modal.Header><Icon name="play" color="green"/> Executar pacote</Modal.Header>
                <Modal.Content>
                    Executar <code>{packageDirPath}</code> via <code>run package</code>?
                    Isso inicia uma nova instância no ecossistema.
                </Modal.Content>
                <Modal.Actions>
                    <Button onClick={() => setConfirmRun(false)}>cancelar</Button>
                    <Button color="green" onClick={() => { setConfirmRun(false); run("run", () => _GetAPI().RunPackage({ packagePath: packageDirPath })) }}>
                        <Icon name="play"/> executar
                    </Button>
                </Modal.Actions>
            </Modal>
        }
    </>
}

const CommandRow = ({ command, depth = 0 }:any) => {
    const children = command.children || []
    return <>
        <Table.Row>
            <Table.Cell style={{ paddingLeft: `${12 + depth * 24}px` }}>
                <Icon name={children.length > 0 ? "folder" : "terminal"}/>
                <code>{command.command || command.namespace}</code>
            </Table.Cell>
            <Table.Cell>{command.description}</Table.Cell>
        </Table.Row>
        {
            children.map((child:any, key:number) =>
                <CommandRow key={key} command={child} depth={depth + 1}/>)
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
        packageRepoPath,
        repositoryPath,
        supervisorSocketPath,
        commandGroup,
        boot,
        package: packageMetadata
    } = executableInformation

    return <Segment>
        <Header>
            <Icon name="terminal"/>
            <Header.Content>
                {executableName}
                <Label size="tiny" color={type === "cli" ? "teal" : "blue"} style={{ marginLeft: "8px" }}>{type}</Label>
                { isDebug && <Label size="tiny" color="grey">debug</Label> }
            </Header.Content>
        </Header>

        <HostActionsBar
            serverManagerInformation={serverManagerInformation}
            packageDirPath={executableInformation.packageDirPath}/>

        <List relaxed size="small">
            <List.Item>
                <List.Icon name="folder outline" verticalAlign="middle"/>
                <List.Content>
                    <List.Header>package</List.Header>
                    <List.Description style={{ wordBreak: "break-all" }}>{packageRepoPath}</List.Description>
                </List.Content>
            </List.Item>
            <List.Item>
                <List.Icon name="database" verticalAlign="middle"/>
                <List.Content>
                    <List.Header>repository</List.Header>
                    <List.Description style={{ wordBreak: "break-all" }}>{repositoryPath}</List.Description>
                </List.Content>
            </List.Item>
            {
                supervisorSocketPath && <List.Item>
                    <List.Icon name="plug" verticalAlign="middle"/>
                    <List.Content>
                        <List.Header>supervisor socket</List.Header>
                        <List.Description style={{ wordBreak: "break-all" }}>{supervisorSocketPath}</List.Description>
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
            commandGroup && Array.isArray(commandGroup.commands)
            ? <>
                <Header as="h4" dividing>Commands ({commandGroup.commands.length})</Header>
                <Table basic="very" compact>
                    <Table.Header>
                        <Table.Row>
                            <Table.HeaderCell>command</Table.HeaderCell>
                            <Table.HeaderCell>description</Table.HeaderCell>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {
                            commandGroup.commands.map((command:any, key:number) =>
                                <CommandRow key={key} command={command}/>)
                        }
                    </Table.Body>
                </Table>
            </>
            : boot
                ? <BootManifestView boot={boot}/>
                : <span style={{ color: "#bbb" }}>sem manifesto (boot.json) para este pacote</span>
        }
    </Segment>
}

// Visualiza o que o pacote expõe a partir do boot.json (aprendido com o
// PackageDeveloper: mostrar o interior do pacote por tipo). Para apps/web:
// params, services e endpoints; para CLI: executáveis declarados.
const BootManifestView = ({ boot }:any) => {
    const params    = Array.isArray(boot.params) ? boot.params : []
    const services  = Array.isArray(boot.services) ? boot.services : []
    const endpoints = Array.isArray(boot.endpoints) ? boot.endpoints : []
    const executables = Array.isArray(boot.executables) ? boot.executables : []

    return <>
        {
            executables.length > 0 && <>
                <Header as="h4" dividing><Icon name="terminal"/> Executables ({executables.length})</Header>
                <List bulleted>
                    { executables.map((e:any, k:number) =>
                        <List.Item key={k}>{e.executableName} — <i style={{ color: "#888" }}>{e.dependency}</i></List.Item>) }
                </List>
            </>
        }
        {
            params.length > 0 && <>
                <Header as="h4" dividing><Icon name="sliders horizontal"/> Params ({params.length})</Header>
                <div>
                    { params.map((p:string, k:number) =>
                        <Label key={k} basic size="small" style={{ margin: "2px" }}>{p}</Label>) }
                </div>
            </>
        }
        {
            services.length > 0 && <>
                <Header as="h4" dividing><Icon name="cogs"/> Services ({services.length})</Header>
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
                <Header as="h4" dividing><Icon name="plug"/> Endpoints ({endpoints.length})</Header>
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
            params.length === 0 && services.length === 0 && endpoints.length === 0 && executables.length === 0 &&
            <span style={{ color: "#bbb" }}>boot.json sem services/endpoints/params declarados</span>
        }
    </>
}

export default ExecutableInformation
