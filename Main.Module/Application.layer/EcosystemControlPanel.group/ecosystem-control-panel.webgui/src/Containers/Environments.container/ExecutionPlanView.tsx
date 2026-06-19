import * as React from "react"
import { useState } from "react"

import {
    Button,
    Icon,
    Input,
    Label,
    Loader,
    Message,
    Modal,
    Table
} from "semantic-ui-react"

const GetIconByLoaderType = (objectLoaderType:string):any => {
    switch(objectLoaderType){
        case "install-nodejs-package-dependencies": return "download"
        case "nodejs-package"                     : return "box"
        case "application-instance"               : return "cube"
        case "service-instance"                   : return "cogs"
        case "endpoint-instance"                  : return "plug"
        case "command-application"                : return "terminal"
        default                                   : return "circle"
    }
}

const GetTaskName = (task:any) => {
    const sp = task.staticParameters || {}
    return sp.namespace || sp.tag || sp.url || sp.name || sp.path || "—"
}

const GetPreconditionsSummary = (task:any) => {
    const rules = task.activationRules && task.activationRules["&&"]
    if(!rules || rules.length === 0) return []
    return rules.map((rule:any) => `${rule.property} = ${rule["="]}`)
}

const IsScalar = (value:any) =>
    value === null || ["string", "number", "boolean"].includes(typeof value)

// Pré-ordem da árvore do plano, carregando o caminho (índices) de cada task
// para localizá-la na estrutura aninhada ao salvar.
const FlattenPlan = (tasks:any[], depth = 0, path:number[] = [], acc:any[] = []) => {
    tasks.forEach((task:any, index:number) => {
        const taskPath = [ ...path, index ]
        acc.push({ task, depth, path: taskPath, rootIndex: depth === 0 ? index : undefined })
        if(task.children && task.children.length > 0)
            FlattenPlan(task.children, depth + 1, taskPath, acc)
    })
    return acc
}

// Atualiza os staticParameters da task no caminho dado, sem mutar o original.
const UpdateTaskStaticParamsAtPath = (executionParams:any[], path:number[], newStaticParameters:any) => {
    const clone = JSON.parse(JSON.stringify(executionParams))
    let node = clone[path[0]]
    for(let i = 1; i < path.length; i++)
        node = node.children[path[i]]
    node.staticParameters = newStaticParameters
    return clone
}

const ExecutionPlanView = ({ executionParams, onSaveExecutionParams }:any) => {

    const [ filterValue, setFilterValue ] = useState<string>("")
    const [ editing, setEditing ]         = useState<any>()   // { path, task, draft }
    const [ isSaving, setIsSaving ]       = useState(false)

    if(!executionParams)
        return <Loader active style={{ margin: "50px" }}/>

    const canEdit = !!onSaveExecutionParams

    const rows = FlattenPlan(executionParams)
        .filter(({ task }) =>
            !filterValue ||
            `${task.objectLoaderType} ${GetTaskName(task)}`.toLowerCase().includes(filterValue.toLowerCase()))

    const countsByType = executionParams.reduce((acc:any, task:any) => {
        const recurse = (t:any) => {
            acc[t.objectLoaderType] = (acc[t.objectLoaderType] || 0) + 1
            ;(t.children || []).forEach(recurse)
        }
        recurse(task)
        return acc
    }, {})

    const startEdit = (path:number[], task:any) =>
        setEditing({ path, task, draft: { ...(task.staticParameters || {}) } })

    const setDraftValue = (key:string, raw:string, original:any) => {
        let value:any = raw
        if(typeof original === "number" && raw.trim() !== "" && !isNaN(Number(raw))) value = Number(raw)
        else if(typeof original === "boolean") value = raw === "true"
        setEditing({ ...editing, draft: { ...editing.draft, [key]: value } })
    }

    const handleConfirmSave = async () => {
        try {
            setIsSaving(true)
            const newPlan = UpdateTaskStaticParamsAtPath(executionParams, editing.path, editing.draft)
            await onSaveExecutionParams(newPlan)
            setEditing(undefined)
        } catch(e) { console.log(e) } finally { setIsSaving(false) }
    }

    return <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {
                    Object.keys(countsByType).map((type:string, key:number) =>
                        <Label key={key} basic size="small">
                            {type}<Label.Detail>{countsByType[type]}</Label.Detail>
                        </Label>)
                }
            </div>
            <Input icon="search" size="small" placeholder="filtrar plano..." value={filterValue} onChange={(e, { value }) => setFilterValue(value)}/>
        </div>

        <div style={{ overflow: "auto", maxHeight: "72vh", border: "1px solid #e0e0e0", borderRadius: "4px" }}>
            <Table celled compact striped style={{ fontSize: ".9em" }}>
                <Table.Header>
                    <Table.Row>
                        <Table.HeaderCell width={1}>#</Table.HeaderCell>
                        <Table.HeaderCell width={4}>type</Table.HeaderCell>
                        <Table.HeaderCell width={5}>name</Table.HeaderCell>
                        <Table.HeaderCell width={5}>preconditions</Table.HeaderCell>
                        { canEdit && <Table.HeaderCell width={1} textAlign="center">edit</Table.HeaderCell> }
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {
                        rows.map(({ task, depth, path, rootIndex }:any, key:number) => {
                            const preconditions = GetPreconditionsSummary(task)
                            return <Table.Row key={key}>
                                <Table.Cell style={{ fontFamily: "monospace", color: "#888" }}>{rootIndex !== undefined ? rootIndex : ""}</Table.Cell>
                                <Table.Cell style={{ color: "#100085" }}>
                                    <Icon name={GetIconByLoaderType(task.objectLoaderType)} style={{ color: "#888" }}/>
                                    {task.objectLoaderType}
                                </Table.Cell>
                                <Table.Cell style={{ paddingLeft: `${12 + depth * 22}px` }}>
                                    { depth > 0 && <span style={{ color: "#bbb" }}>↳ </span> }
                                    <strong>{GetTaskName(task)}</strong>
                                    { task.children && task.children.length > 0 && <Label size="mini" circular style={{ marginLeft: "6px" }}>{task.children.length}</Label> }
                                </Table.Cell>
                                <Table.Cell>
                                    {
                                        preconditions.length === 0
                                        ? <span style={{ color: "#bbb" }}>—</span>
                                        : preconditions.map((p:string, k:number) => <div key={k} style={{ fontFamily: "monospace", fontSize: ".85em", color: "#666" }}>{p}</div>)
                                    }
                                </Table.Cell>
                                {
                                    canEdit && <Table.Cell textAlign="center">
                                        <Button icon size="mini" basic onClick={() => startEdit(path, task)}><Icon name="pencil"/></Button>
                                    </Table.Cell>
                                }
                            </Table.Row>
                        })
                    }
                </Table.Body>
            </Table>
        </div>

        {
            editing &&
            <Modal open={true} onClose={() => setEditing(undefined)}>
                <Modal.Header>
                    <Icon name="pencil"/> Editar task — {GetTaskName(editing.task)} <span style={{ color: "#999", fontSize: ".8em" }}>[{editing.task.objectLoaderType}]</span>
                </Modal.Header>
                <Modal.Content scrolling>
                    <Message warning size="small" icon>
                        <Icon name="warning sign"/>
                        <Message.Content>
                            <Message.Header>Alteração do plano de execução</Message.Header>
                            Edita o <code>execution-params.json</code> deste environment. Afeta a <strong>próxima execução</strong> (não a instância já em execução) e pode quebrar o ambiente.
                        </Message.Content>
                    </Message>
                    <Table celled compact>
                        <Table.Header>
                            <Table.Row><Table.HeaderCell width={6}>parameter</Table.HeaderCell><Table.HeaderCell>value</Table.HeaderCell></Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {
                                Object.keys(editing.draft).map((paramKey:string, key:number) =>
                                    <Table.Row key={key}>
                                        <Table.Cell><strong>{paramKey}</strong></Table.Cell>
                                        <Table.Cell>
                                            {
                                                IsScalar(editing.task.staticParameters[paramKey])
                                                ? <Input fluid size="small" value={editing.draft[paramKey] === undefined ? "" : String(editing.draft[paramKey])}
                                                    onChange={(e, { value }) => setDraftValue(paramKey, value, editing.task.staticParameters[paramKey])}/>
                                                : <code style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(editing.draft[paramKey], null, 2)}</code>
                                            }
                                        </Table.Cell>
                                    </Table.Row>)
                            }
                        </Table.Body>
                    </Table>
                </Modal.Content>
                <Modal.Actions>
                    <Button onClick={() => setEditing(undefined)} disabled={isSaving}>cancelar</Button>
                    <Button color="orange" loading={isSaving} onClick={handleConfirmSave}><Icon name="save"/> salvar no plano</Button>
                </Modal.Actions>
            </Modal>
        }
    </div>
}

export default ExecutionPlanView
