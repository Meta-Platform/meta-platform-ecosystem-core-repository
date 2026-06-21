import * as React from "react"
import { useState } from "react"

import {
    Button,
    Icon,
    Input,
    Label,
    Table
} from "semantic-ui-react"

// Ordem do pipeline de loaders (deps → pacotes → instâncias → serviços/endpoints).
const LOADER_ORDER = [
    "install-nodejs-package-dependencies",
    "nodejs-package",
    "application-instance",
    "service-instance",
    "endpoint-instance",
    "command-application"
]

import StatusBadge, { GetStatusColor, GetSeverityRank } from "../../Components/StatusBadge"
import { LoaderAlias } from "../../Utils/LoaderType"

const GetColorByStatus = GetStatusColor

// Ordem do ciclo de vida (transitórios → estáveis → finais).
const STATUS_ORDER = [
    "AWAITING_PRECONDITIONS",
    "PRECONDITIONS_COMPLETED",
    "PREPPED_TO_START",
    "STARTING",
    "ACTIVE",
    "STOPPING",
    "FINISHED",
    "FAILURE",
    "TERMINATED"
]

// Ícone por object loader, espelhando os 6 loaders oficiais.
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
    return sp.namespace || sp.tag || sp.url || sp.name || sp.path || `task ${task.taskId}`
}

const GetTaskDetail = (task:any) => {
    const sp = task.staticParameters || {}
    if(sp.port) return `:${sp.port}`
    if(sp.url)  return sp.url
    if(sp.path) return sp.path
    return ""
}

// Execução saudável = todas em ACTIVE/FINISHED e nenhuma em FAILURE/TERMINATED.
const ComputeHealth = (taskList:any[]) => {
    if(taskList.length === 0) return { label: "empty", color: "grey", icon: "circle outline" }
    const hasFailure = taskList.some((t) => t.status === "FAILURE" || t.status === "TERMINATED")
    if(hasFailure) return { label: "unhealthy", color: "red", icon: "warning circle" }
    const allStable = taskList.every((t) => t.status === "ACTIVE" || t.status === "FINISHED")
    if(allStable) return { label: "healthy", color: "green", icon: "check circle" }
    return { label: "starting…", color: "yellow", icon: "spinner" }
}

const SummaryBar = ({ taskList }:any) => {
    const counts = taskList.reduce((acc:any, task:any) => {
        acc[task.status] = (acc[task.status] || 0) + 1
        return acc
    }, {})

    const orderedStatuses = [
        ...STATUS_ORDER.filter((s) => counts[s] !== undefined),
        ...Object.keys(counts).filter((s) => !STATUS_ORDER.includes(s))
    ]

    const health = ComputeHealth(taskList)

    return <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
        <Label size="large" color={health.color as any}>
            <Icon name={health.icon as any}/> {health.label}
        </Label>
        <Label size="large"><Icon name="tasks"/> {taskList.length} tasks</Label>
        {
            orderedStatuses.map((status:string, key:number) =>
                <Label key={key} color={GetColorByStatus(status)} size="small">
                    {status} <Label.Detail>{counts[status]}</Label.Detail>
                </Label>)
        }
    </div>
}

const COLUMNS = [
    { key: "taskId",           label: "TID",    width: 1 },
    { key: "pTaskId",          label: "PTID",   width: 1 },
    { key: "name",             label: "name",   width: 5 },
    { key: "objectLoaderType", label: "type",   width: 6 },
    { key: "status",           label: "status", width: 3 }
]

// Pré-ordem da árvore pai→filhos (espelha application-instance → service/endpoint).
const BuildTreeOrder = (taskList:any[]) => {
    const byParent:any = {}
    const ids = new Set(taskList.map((t) => t.taskId))
    taskList.forEach((task) => {
        const parent = (task.pTaskId !== undefined && task.pTaskId !== null && ids.has(task.pTaskId)) ? task.pTaskId : "__root__"
        if(!byParent[parent]) byParent[parent] = []
        byParent[parent].push(task)
    })
    Object.keys(byParent).forEach((k) => byParent[k].sort((a:any, b:any) => a.taskId - b.taskId))

    const ordered:any[] = []
    const walk = (parentKey:any, depth:number) => {
        (byParent[parentKey] || []).forEach((task:any) => {
            ordered.push({ task, depth })
            walk(task.taskId, depth + 1)
        })
    }
    walk("__root__", 0)
    return ordered
}

const TaskNameCell = ({ task, depth = 0 }:any) => {
    const detail = GetTaskDetail(task)
    const name = GetTaskName(task)
    return <Table.Cell style={{ paddingLeft: `${12 + depth * 22}px`, maxWidth: 0 }} title={`${name}${detail ? "  ·  " + detail : ""}`}>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", overflow: "hidden" }}>
            { depth > 0 && <Icon name="level up alternate" rotated="clockwise" style={{ color: "#bbb", flex: "0 0 auto" }}/> }
            <Icon name={GetIconByLoaderType(task.objectLoaderType)} style={{ color: "#888", flex: "0 0 auto" }}/>
            <strong style={{ whiteSpace: "nowrap", flex: "0 0 auto" }}>{name}</strong>
            { detail && <span style={{ color: "#999", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{detail}</span> }
            { task.hasChildTasks && <Label size="mini" circular style={{ flex: "0 0 auto" }}>parent</Label> }
        </div>
    </Table.Cell>
}

const StatusCell = ({ task }:any) =>
    <Table.Cell style={{ fontFamily: "monospace" }}>
        <Icon name="circle" size="small" color={GetColorByStatus(task.status)}/>
        {task.taskId}
    </Table.Cell>

const TaskProcessMonitor = ({
    instanceTaskList = [],
    taskId,
    onSelectTask
}:any) => {

    // Padrão: ordena por severidade (problemáticos primeiro).
    const [ sortColumn, setSortColumn ]       = useState<string>("status")
    const [ sortDirection, setSortDirection ] = useState<"ascending" | "descending">("ascending")
    const [ filterValue, setFilterValue ]     = useState<string>("")
    // visão unificada: lista (flat) | hierarquia (parent→filhos) | por loader
    const [ viewMode, setViewMode ]           = useState<"flat" | "tree" | "loader">("tree")

    const _GetSortableValue = (task:any, column:string) => {
        if(column === "name")   return GetTaskName(task).toString().toLowerCase()
        if(column === "status") return GetSeverityRank(task.status)   // menor = mais severo
        const value = task[column]
        return typeof value === "string" ? value.toLowerCase() : (value ?? -1)
    }

    const handleSort = (column:string) => {
        if(viewMode !== "flat") return
        if(sortColumn === column){
            setSortDirection(sortDirection === "ascending" ? "descending" : "ascending")
        } else {
            setSortColumn(column)
            setSortDirection("ascending")
        }
    }

    const matchesFilter = (task:any) => {
        if(!filterValue) return true
        const haystack = `${task.taskId} ${task.pTaskId ?? ""} ${GetTaskName(task)} ${task.objectLoaderType} ${task.status}`.toLowerCase()
        return haystack.includes(filterValue.toLowerCase())
    }

    const renderRow = (task:any, depth:number, index:number) =>
        <Table.Row
            key={index}
            active={task.taskId === taskId}
            onClick={() => onSelectTask(task.taskId)}
            style={{ cursor: "pointer" }}>
            <StatusCell task={task}/>
            <Table.Cell style={{ fontFamily: "monospace", color: "#888" }}>{task.pTaskId ?? "—"}</Table.Cell>
            <TaskNameCell task={task} depth={depth}/>
            <Table.Cell style={{ color: "#100085", overflow: "hidden" }} title={task.objectLoaderType}>
                <span style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "monospace", fontSize: ".92em" }}>{task.objectLoaderType}</span>
            </Table.Cell>
            <Table.Cell><StatusBadge status={task.status}/></Table.Cell>
        </Table.Row>

    let rows:any[]
    if(viewMode === "tree"){
        // hierarquia: cada filho aninhado sob o pai (pTaskId) = relação de dependência
        rows = BuildTreeOrder(instanceTaskList)
            .filter(({ task }) => matchesFilter(task))
            .map(({ task, depth }, index) => renderRow(task, depth, index))
    } else if(viewMode === "loader"){
        // agrupado pelo object loader, na ordem do pipeline de execução
        const filtered = instanceTaskList.filter(matchesFilter)
        const groups:any = {}
        filtered.forEach((t:any) => { (groups[t.objectLoaderType] = groups[t.objectLoaderType] || []).push(t) })
        const orderedLoaders = [
            ...LOADER_ORDER.filter((l) => groups[l]),
            ...Object.keys(groups).filter((l) => !LOADER_ORDER.includes(l))
        ]
        rows = []
        let idx = 0
        orderedLoaders.forEach((loader:string) => {
            rows.push(
                <Table.Row key={`g-${loader}`} style={{ background: "#eef1f4" }}>
                    <Table.Cell colSpan={5} style={{ fontFamily: "monospace", fontWeight: 700, fontSize: ".9em", color: "#3a4047" }}>
                        <Icon name={GetIconByLoaderType(loader)} style={{ color: "#7b8794" }}/> {loader}
                        <Label circular size="mini" style={{ marginLeft: "6px" }}>{groups[loader].length}</Label>
                    </Table.Cell>
                </Table.Row>
            )
            groups[loader].sort((a:any, b:any) => a.taskId - b.taskId).forEach((t:any) => rows.push(renderRow(t, 0, idx++)))
        })
    } else {
        const sorted = [...instanceTaskList.filter(matchesFilter)].sort((a:any, b:any) => {
            const va = _GetSortableValue(a, sortColumn)
            const vb = _GetSortableValue(b, sortColumn)
            if(va < vb) return sortDirection === "ascending" ? -1 : 1
            if(va > vb) return sortDirection === "ascending" ? 1 : -1
            return 0
        })
        rows = sorted.map((task:any, index:number) => renderRow(task, 0, index))
    }

    return <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "10px" }}>
            <Button.Group size="mini">
                <Button active={viewMode === "flat"}   onClick={() => setViewMode("flat")}><Icon name="list"/> lista</Button>
                <Button active={viewMode === "tree"}   onClick={() => setViewMode("tree")}><Icon name="sitemap"/> hierarquia</Button>
                <Button active={viewMode === "loader"} onClick={() => setViewMode("loader")}><Icon name="boxes"/> por loader</Button>
            </Button.Group>
            <Input
                icon="search"
                size="small"
                placeholder="filtrar tasks..."
                value={filterValue}
                onChange={(e, { value }) => setFilterValue(value)}/>
        </div>

        <div style={{ overflow: "auto", maxHeight: "78vh", border: "1px solid #e0e0e0", borderRadius: "4px" }}>
            <Table sortable={viewMode === "flat"} compact selectable unstackable style={{ fontSize: ".9em", tableLayout: "fixed", width: "100%", border: "none" }}>
                <Table.Header>
                    <Table.Row>
                        {
                            COLUMNS.map((column) =>
                                <Table.HeaderCell
                                    key={column.key}
                                    width={column.width as any}
                                    sorted={viewMode === "flat" && sortColumn === column.key ? sortDirection : undefined}
                                    onClick={() => handleSort(column.key)}
                                    style={{ position: "sticky", top: 0, zIndex: 1 }}>
                                    {column.label}
                                </Table.HeaderCell>)
                        }
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    { rows }
                    {
                        rows.length === 0 &&
                        <Table.Row>
                            <Table.Cell colSpan={COLUMNS.length} textAlign="center" style={{ color: "grey" }}>
                                nenhuma task corresponde ao filtro
                            </Table.Cell>
                        </Table.Row>
                    }
                </Table.Body>
            </Table>
        </div>
    </div>
}

export default TaskProcessMonitor
