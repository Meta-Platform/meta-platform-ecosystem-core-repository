import * as React from "react"
import { useState } from "react"

import {
    Checkbox,
    Icon,
    Input,
    Label,
    Table
} from "semantic-ui-react"

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
    { key: "name",             label: "name",   width: 6 },
    { key: "objectLoaderType", label: "type",   width: 4 },
    { key: "status",           label: "status", width: 2 }
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
    return <Table.Cell style={{ paddingLeft: `${12 + depth * 22}px` }}>
        { depth > 0 && <Icon name="level up alternate" rotated="clockwise" style={{ color: "#bbb" }}/> }
        <Icon name={GetIconByLoaderType(task.objectLoaderType)} style={{ color: "#888" }}/>
        <strong>{GetTaskName(task)}</strong>
        { detail && <span style={{ color: "#999", marginLeft: "6px" }}>{detail}</span> }
        { task.hasChildTasks && <Label size="mini" circular style={{ marginLeft: "6px" }}>parent</Label> }
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
    const [ treeView, setTreeView ]           = useState<boolean>(false)

    const _GetSortableValue = (task:any, column:string) => {
        if(column === "name")   return GetTaskName(task).toString().toLowerCase()
        if(column === "status") return GetSeverityRank(task.status)   // menor = mais severo
        const value = task[column]
        return typeof value === "string" ? value.toLowerCase() : (value ?? -1)
    }

    const handleSort = (column:string) => {
        if(treeView) return
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
            <Table.Cell style={{ color: "#100085" }} title={task.objectLoaderType}>{LoaderAlias(task.objectLoaderType)}</Table.Cell>
            <Table.Cell><StatusBadge status={task.status}/></Table.Cell>
        </Table.Row>

    let rows:any[]
    if(treeView){
        rows = BuildTreeOrder(instanceTaskList)
            .filter(({ task }) => matchesFilter(task))
            .map(({ task, depth }, index) => renderRow(task, depth, index))
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
            <SummaryBar taskList={instanceTaskList}/>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <Checkbox
                    toggle
                    label="tree view"
                    checked={treeView}
                    onChange={() => setTreeView(!treeView)}/>
                <Input
                    icon="search"
                    size="small"
                    placeholder="filtrar tasks..."
                    value={filterValue}
                    onChange={(e, { value }) => setFilterValue(value)}/>
            </div>
        </div>

        <div style={{ overflow: "auto", maxHeight: "78vh", border: "1px solid #e0e0e0", borderRadius: "4px" }}>
            <Table sortable={!treeView} celled compact selectable striped style={{ fontSize: ".9em" }}>
                <Table.Header>
                    <Table.Row>
                        {
                            COLUMNS.map((column) =>
                                <Table.HeaderCell
                                    key={column.key}
                                    width={column.width as any}
                                    sorted={!treeView && sortColumn === column.key ? sortDirection : undefined}
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
