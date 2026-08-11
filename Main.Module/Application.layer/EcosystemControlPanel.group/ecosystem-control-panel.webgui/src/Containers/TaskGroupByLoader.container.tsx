import * as React from "react"
import { Badge, StatusBadge } from "@i-components"

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
    <button
        type="button"
        onClick={() => onSelectTask(task.taskId)}
        className={`ecp-stage-task ${task.taskId === taskId ? "is-selected" : ""}`.trim()}>
        <span className="ecp-stage-task__id">{task.taskId}</span>
        <span className="ecp-stage-task__name">{GetTaskName(task)}</span>
        <StatusBadge status={task.status}/>
    </button>

const Stage = ({ stage, tasks, index, isLast, taskId, onSelectTask }:any) =>
    <div className="ecp-stage">
        { /* coluna do trilho (número + conector vertical) */ }
        <div className="ecp-stage__rail">
            <span className="ecp-stage__marker" style={{ color: stage.color }}>{index + 1}</span>
            { !isLast && <span className="ecp-stage__connector"/> }
        </div>

        { /* card do estágio */ }
        <div
            className={`ecp-stage__card ${stage.child ? "is-child" : ""}`.trim()}
            style={{ borderLeftColor: stage.color }}>
            <div className="ecp-stage__head">
                { stage.child && <span className="ecp-stage__childmark">↳</span> }
                <strong className="ecp-stage__label" style={{ color: stage.color }}>{stage.label}</strong>
                <span className="ecp-stage__type">{stage.type}</span>
                <Badge className="ecp-stage__count">{tasks.length}</Badge>
            </div>
            <div className="ecp-stage__tasks">
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

    return <div className="ecp-stage-list">
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
