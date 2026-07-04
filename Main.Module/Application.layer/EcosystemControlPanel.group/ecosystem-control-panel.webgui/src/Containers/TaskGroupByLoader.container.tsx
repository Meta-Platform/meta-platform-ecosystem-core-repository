import * as React from "react"
import { Label } from "semantic-ui-react"

import StatusBadge from "../Components/StatusBadge"

// Ordem do pipeline de execução (estágios), conforme o Task Executor:
// instala deps -> carrega packages -> instancia a app -> (serviços/endpoints
// como filhos) ; command-application é o caminho CLI.
const LOADER_STAGES = [
    { type: "install-nodejs-package-dependencies", label: "Install dependencies", color: "var(--mp-muted-2)", child: false },
    { type: "nodejs-package",                      label: "Load packages",        color: "var(--mp-accent-blue)", child: false },
    { type: "application-instance",                label: "Application instance",  color: "var(--mp-accent-blue)", child: false },
    { type: "command-application",                 label: "Command application",   color: "var(--mp-accent-violet)", child: false },
    { type: "service-instance",                    label: "Services",              color: "var(--mp-success)", child: true  },
    { type: "endpoint-instance",                   label: "Endpoints",             color: "var(--mp-accent-orange)", child: true  }
]

const GetTaskName = (task:any) => {
    const sp = task.staticParameters || {}
    return sp.namespace || sp.tag || sp.url || sp.name || `task ${task.taskId}`
}

const TaskRow = ({ task, taskId, onSelectTask }:any) =>
    <div
        onClick={() => onSelectTask(task.taskId)}
        style={{
            display: "flex", alignItems: "center", gap: "8px", padding: "4px 8px", cursor: "pointer",
            borderRadius: "4px", background: task.taskId === taskId ? "#e8f0fa" : undefined
        }}>
        <span style={{ fontFamily: "monospace", color: "var(--mp-muted)", width: "34px" }}>{task.taskId}</span>
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{GetTaskName(task)}</span>
        <StatusBadge status={task.status}/>
    </div>

const Stage = ({ stage, tasks, index, isLast, taskId, onSelectTask }:any) =>
    <div style={{ display: "flex", gap: "12px" }}>
        { /* coluna do trilho (número + conector vertical) */ }
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "34px" }}>
            <div style={{
                width: "28px", height: "28px", borderRadius: "50%", background: stage.color, color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", fontWeight: 700, fontSize: ".9em"
            }}>
                {index + 1}
            </div>
            { !isLast && <div style={{ flex: 1, width: "2px", background: "var(--mp-surface-muted)", minHeight: "12px", marginTop: "2px" }}/> }
        </div>

        { /* card do estágio */ }
        <div style={{
            flex: 1, marginBottom: "12px", border: "1px solid var(--mp-line-faint)", borderLeft: `4px solid ${stage.color}`,
            borderRadius: "8px", background: "var(--mp-surface)", marginLeft: stage.child ? "28px" : 0
        }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", borderBottom: "1px solid #f0f0f0" }}>
                { stage.child && <span style={{ color: "var(--mp-muted-2)" }}>↳</span> }
                <strong style={{ color: stage.color }}>{stage.label}</strong>
                <span style={{ color: "var(--mp-muted-2)", fontSize: ".82em" }}>{stage.type}</span>
                <Label circular size="mini" style={{ marginLeft: "auto" }}>{tasks.length}</Label>
            </div>
            <div style={{ padding: "6px 8px" }}>
                {
                    tasks
                        .sort((a:any, b:any) => a.taskId - b.taskId)
                        .map((task:any, key:number) =>
                            <TaskRow key={key} task={task} taskId={taskId} onSelectTask={onSelectTask}/>)
                }
            </div>
        </div>
    </div>

const TaskGroupByLoaderContainer = ({ instanceTaskList = [], taskId, onSelectTask }:any) => {

    const grouped = instanceTaskList.reduce((acc:any, task:any) => {
        (acc[task.objectLoaderType] = acc[task.objectLoaderType] || []).push(task)
        return acc
    }, {})

    // estágios conhecidos (na ordem do pipeline) que têm tasks, + quaisquer
    // loaders desconhecidos ao final
    const knownTypes = LOADER_STAGES.map((s) => s.type)
    const stages = [
        ...LOADER_STAGES.filter((s) => grouped[s.type]),
        ...Object.keys(grouped)
            .filter((t) => !knownTypes.includes(t))
            .map((t) => ({ type: t, label: t, icon: "question", color: "var(--mp-muted-2)", child: false }))
    ]

    return <div style={{ padding: "6px 2px" }}>
        {
            stages.map((stage:any, index:number) =>
                <Stage
                    key={stage.type}
                    stage={stage}
                    tasks={grouped[stage.type]}
                    index={index}
                    isLast={index === stages.length - 1}
                    taskId={taskId}
                    onSelectTask={onSelectTask}/>)
        }
    </div>
}

export default TaskGroupByLoaderContainer
