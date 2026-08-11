import * as React from "react"
import { useState } from "react"

import {
    Badge,
    Banner,
    Button,
    DataTable,
    Dialog,
    Icon,
    IconButton,
    SearchInput,
    SkeletonList,
    StatusChip,
    StatusStrip,
    TextInput
} from "@i-components"

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
        return <SkeletonList rows={8}/>

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

    const columns = [
        {
            key: "index",
            header: "#",
            width: "6%",
            mono: true,
            render: ({ rootIndex }:any) => rootIndex !== undefined ? rootIndex : ""
        },
        {
            key: "type",
            header: "type",
            width: "26%",
            render: ({ task }:any) =>
                <span className="ecp-plan-task">
                    <Icon name={GetIconByLoaderType(task.objectLoaderType)} tone="muted"/>
                    {task.objectLoaderType}
                </span>
        },
        {
            key: "name",
            header: "name",
            width: "32%",
            // O recuo é por nível da árvore, então vai inline (valor calculado).
            render: ({ task, depth }:any) =>
                <span className="ecp-plan-task" style={{ paddingLeft: `${depth * 22}px` }}>
                    { depth > 0 && <span className="ecp-plan-task__arrow">↳</span> }
                    <strong>{GetTaskName(task)}</strong>
                    { task.children && task.children.length > 0 && <Badge>{task.children.length}</Badge> }
                </span>
        },
        {
            key: "preconditions",
            header: "preconditions",
            width: "28%",
            render: ({ task }:any) => {
                const preconditions = GetPreconditionsSummary(task)
                return preconditions.length === 0
                    ? <span className="ecp-plan-none">—</span>
                    : preconditions.map((rule:string, key:number) =>
                        <div key={key} className="ecp-plan-rule">{rule}</div>)
            }
        },
        ...(canEdit ? [{
            key: "edit",
            header: "edit",
            width: "8%",
            align: "center" as const,
            render: ({ task, path }:any) =>
                <IconButton icon="pencil" label="edit task" size="sm" onClick={() => startEdit(path, task)}/>
        }] : [])
    ]

    const draftKeys = editing ? Object.keys(editing.draft) : []

    return <div>
        <StatusStrip
            className="ecp-plan-toolbar"
            right={
                <SearchInput
                    value={filterValue}
                    placeholder="filter plan..."
                    onValueChange={setFilterValue}/>
            }>
            {
                Object.keys(countsByType).map((type:string, key:number) =>
                    <StatusChip key={key} label={type} count={countsByType[type]}/>)
            }
        </StatusStrip>

        <div className="ecp-plan-scroll">
            <DataTable
                columns={columns}
                rows={rows}
                rowKey={(row:any) => row.path.join(".")}
                dense
                emptyMessage="No task matches this filter."/>
        </div>

        {
            editing &&
            <Dialog
                open={true}
                size="lg"
                icon="pencil"
                title={`Edit task — ${GetTaskName(editing.task)}`}
                subtitle={editing.task.objectLoaderType}
                onClose={() => setEditing(undefined)}
                actions={<>
                    <Button onClick={() => setEditing(undefined)} disabled={isSaving}>cancel</Button>
                    <Button variant="primary" icon="save" loading={isSaving} onClick={handleConfirmSave}>save to plan</Button>
                </>}>
                <Banner tone="warning" title="Execution plan change" className="ecp-plan-warn">
                    Edits <code>execution-params.json</code> of this environment. It affects the <strong>next
                    execution</strong> (not the instance already running) and may break the environment.
                </Banner>
                <DataTable
                    columns={[
                        {
                            key: "parameter",
                            header: "parameter",
                            width: "38%",
                            render: ({ paramKey }:any) => <strong>{paramKey}</strong>
                        },
                        {
                            key: "value",
                            header: "value",
                            render: ({ paramKey }:any) =>
                                IsScalar(editing.task.staticParameters[paramKey])
                                ? <TextInput
                                    value={editing.draft[paramKey] === undefined ? "" : String(editing.draft[paramKey])}
                                    onChange={(event:any) => setDraftValue(paramKey, event.target.value, editing.task.staticParameters[paramKey])}/>
                                : <pre className="ecp-plan-json">{JSON.stringify(editing.draft[paramKey], null, 2)}</pre>
                        }
                    ]}
                    rows={draftKeys.map((paramKey:string) => ({ paramKey }))}
                    rowKey={(row:any) => row.paramKey}
                    dense
                    emptyMessage="This task has no static parameter."/>
            </Dialog>
        }
    </div>
}

export default ExecutionPlanView
