import * as React from "react"
import { useState } from "react"

import {
    Icon,
    Label,
    Table
} from "semantic-ui-react"

import StatusBadge, { GetStatusColor, GetSeverityRank } from "../../Components/StatusBadge"

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

const COLUMNS = [
    { key: "taskId",           label: "TID",    width: 1 },
    { key: "pTaskId",          label: "PTID",   width: 1 },
    { key: "name",             label: "name",   width: 5 },
    { key: "objectLoaderType", label: "type",   width: 6 },
    { key: "status",           label: "status", width: 3 }
]

const TaskNameCell = ({ task }:any) => {
    const detail = GetTaskDetail(task)
    const name = GetTaskName(task)
    return <Table.Cell style={{ paddingLeft: "12px", maxWidth: 0 }} title={`${name}${detail ? "  ·  " + detail : ""}`}>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", overflow: "hidden" }}>
            <Icon name={GetIconByLoaderType(task.objectLoaderType)} style={{ color: "var(--mp-muted)", flex: "0 0 auto" }}/>
            <strong style={{ whiteSpace: "nowrap", flex: "0 0 auto" }}>{name}</strong>
            { detail && <span style={{ color: "var(--mp-muted-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{detail}</span> }
            { task.hasChildTasks && <Label size="mini" circular style={{ flex: "0 0 auto" }}>parent</Label> }
        </div>
    </Table.Cell>
}

const StatusCell = ({ task }:any) =>
    <Table.Cell style={{ fontFamily: "var(--mp-font-mono)" }}>
        <Icon name="circle" size="small" color={GetColorByStatus(task.status)}/>
        {task.taskId}
    </Table.Cell>

// Visão única: LISTA (flat), ordenável por coluna. O filtro é controlado pelo
// container (fica na barra de abas do socket detail, não numa linha própria).
const TaskProcessMonitor = ({
    instanceTaskList = [],
    taskId,
    onSelectTask,
    filterValue = ""
}:any) => {

    // Padrão: ordena por severidade (problemáticos primeiro).
    const [ sortColumn, setSortColumn ]       = useState<string>("status")
    const [ sortDirection, setSortDirection ] = useState<"ascending" | "descending">("ascending")

    const _GetSortableValue = (task:any, column:string) => {
        if(column === "name")   return GetTaskName(task).toString().toLowerCase()
        if(column === "status") return GetSeverityRank(task.status)   // menor = mais severo
        const value = task[column]
        return typeof value === "string" ? value.toLowerCase() : (value ?? -1)
    }

    const handleSort = (column:string) => {
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

    const renderRow = (task:any, index:number) =>
        <Table.Row
            key={index}
            active={task.taskId === taskId}
            onClick={() => onSelectTask(task.taskId)}
            style={{ cursor: "pointer" }}>
            <StatusCell task={task}/>
            <Table.Cell style={{ fontFamily: "var(--mp-font-mono)", color: "var(--mp-muted)" }}>{task.pTaskId ?? "—"}</Table.Cell>
            <TaskNameCell task={task}/>
            <Table.Cell style={{ color: "var(--mp-accent-blue)", overflow: "hidden" }} title={task.objectLoaderType}>
                <span style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "var(--mp-font-mono)", fontSize: ".92em" }}>{task.objectLoaderType}</span>
            </Table.Cell>
            <Table.Cell><StatusBadge status={task.status}/></Table.Cell>
        </Table.Row>

    const sorted = [...instanceTaskList.filter(matchesFilter)].sort((a:any, b:any) => {
        const va = _GetSortableValue(a, sortColumn)
        const vb = _GetSortableValue(b, sortColumn)
        if(va < vb) return sortDirection === "ascending" ? -1 : 1
        if(va > vb) return sortDirection === "ascending" ? 1 : -1
        return 0
    })
    const rows = sorted.map((task:any, index:number) => renderRow(task, index))

    return <div style={{ overflow: "auto", flex: "1 1 auto", minHeight: 0, border: "var(--mp-border-thin)", borderRadius: "var(--mp-radius-md)" }}>
        <Table sortable compact selectable unstackable style={{ fontSize: ".9em", tableLayout: "fixed", width: "100%", border: "none" }}>
            <Table.Header>
                <Table.Row>
                    {
                        COLUMNS.map((column) =>
                            <Table.HeaderCell
                                key={column.key}
                                width={column.width as any}
                                sorted={sortColumn === column.key ? sortDirection : undefined}
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
                        <Table.Cell colSpan={COLUMNS.length} textAlign="center" style={{ color: "var(--mp-muted)" }}>
                            no tasks match the filter
                        </Table.Cell>
                    </Table.Row>
                }
            </Table.Body>
        </Table>
    </div>
}

export default TaskProcessMonitor
