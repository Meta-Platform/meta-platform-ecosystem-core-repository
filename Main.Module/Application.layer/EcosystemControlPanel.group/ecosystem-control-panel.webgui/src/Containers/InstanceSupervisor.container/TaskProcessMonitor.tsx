import * as React from "react"
import { useState } from "react"

import {
    EmptyState,
    Icon,
    StatusBadge,
    GetSeverityRank,
    GetStatusTone
} from "@i-components"

// O tom "done" do registro de status não existe na escala de tons do Icon —
// nesse caso o ponto fica em cinza (muted), que é o que "done" significa aqui.
const GetDotTone = (status:string) => {
    const tone = GetStatusTone(status)
    return tone === "done" ? "muted" : tone
}

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
    { key: "taskId",           label: "TID",    width: "8%"  },
    { key: "pTaskId",          label: "PTID",   width: "8%"  },
    { key: "name",             label: "name",   width: "32%" },
    { key: "objectLoaderType", label: "type",   width: "34%" },
    { key: "status",           label: "status", width: "18%" }
]

const TaskNameCell = ({ task }:any) => {
    const detail = GetTaskDetail(task)
    const name = GetTaskName(task)
    return <td title={`${name}${detail ? "  ·  " + detail : ""}`}>
        <span className="ecp-task-name">
            <Icon name={GetIconByLoaderType(task.objectLoaderType)} tone="muted"/>
            <strong>{name}</strong>
            { detail && <span className="ecp-task-name__detail">{detail}</span> }
            { task.hasChildTasks && <span className="mp-type-chip">parent</span> }
        </span>
    </td>
}

const StatusCell = ({ task }:any) =>
    <td className="is-mono">
        <Icon name="circle" size="small" tone={GetDotTone(task.status)}/> {task.taskId}
    </td>

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
        <tr
            key={index}
            className={`is-clickable ${task.taskId === taskId ? "is-selected" : ""}`.trim()}
            onClick={() => onSelectTask(task.taskId)}>
            <StatusCell task={task}/>
            <td className="is-mono ecp-task-table__ptid">{task.pTaskId ?? "—"}</td>
            <TaskNameCell task={task}/>
            <td className="ecp-task-table__type" title={task.objectLoaderType}>
                <span className="ecp-truncate">{task.objectLoaderType}</span>
            </td>
            <td><StatusBadge status={task.status}/></td>
        </tr>

    const sorted = [...instanceTaskList.filter(matchesFilter)].sort((a:any, b:any) => {
        const va = _GetSortableValue(a, sortColumn)
        const vb = _GetSortableValue(b, sortColumn)
        if(va < vb) return sortDirection === "ascending" ? -1 : 1
        if(va > vb) return sortDirection === "ascending" ? 1 : -1
        return 0
    })
    const rows = sorted.map((task:any, index:number) => renderRow(task, index))

    // Ledger table à mão: DataTable do kit não ordena por coluna nem fixa o
    // cabeçalho na rolagem, que é o que este monitor precisa.
    return <div className="mp-table-wrap ecp-task-table-wrap">
        <table className="mp-table is-dense ecp-task-table">
            <thead>
                <tr>
                    {
                        COLUMNS.map((column) =>
                            <th
                                key={column.key}
                                style={{ width: column.width }}
                                aria-sort={sortColumn === column.key ? sortDirection : undefined}>
                                <button
                                    type="button"
                                    className="ecp-task-table__sort"
                                    onClick={() => handleSort(column.key)}>
                                    {column.label}
                                    {
                                        sortColumn === column.key &&
                                        <Icon name={sortDirection === "ascending" ? "caret up" : "caret down"}/>
                                    }
                                </button>
                            </th>)
                    }
                </tr>
            </thead>
            <tbody>
                { rows }
                {
                    rows.length === 0 &&
                    <tr>
                        <td colSpan={COLUMNS.length}>
                            <EmptyState icon="tasks" message="no tasks match the filter"/>
                        </td>
                    </tr>
                }
            </tbody>
        </table>
    </div>
}

export default TaskProcessMonitor
