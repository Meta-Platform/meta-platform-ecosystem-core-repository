import { MarkerType } from "reactflow"

// Cor do nó por object loader (os 6 loaders oficiais do Task Executor).
const GetNodeColor = (objectLoaderType:string) => {
    switch(objectLoaderType){
        case "install-nodejs-package-dependencies": return "#eceff1"
        case "nodejs-package"                     : return "#e3edf7"
        case "application-instance"               : return "#d1e7ff"
        case "service-instance"                   : return "#e7f5e9"
        case "endpoint-instance"                  : return "#fff3e0"
        case "command-application"                : return "#ede7f6"
        default                                   : return "#ffffff"
    }
}

const GetTaskName = (task:any) => {
    const sp = task.staticParameters || {}
    return sp.namespace || sp.tag || sp.url || sp.name || task.objectLoaderType
}

// Percorre o plano (incluindo children) atribuindo ids estáveis e montando:
//  - nós (1 por task)
//  - índices por tag e por namespace (para resolver dependências de ativação)
//  - arestas pai->filho (children)
const _Walk = (tasks:any[], parentId:string | null, ctx:any) => {
    tasks.forEach((task:any) => {
        const id = `t${ctx.counter++}`
        const sp = task.staticParameters || {}

        ctx.nodes.push({
            id,
            data: { label: `${GetTaskName(task)}\n[${task.objectLoaderType}]` },
            style: {
                background: GetNodeColor(task.objectLoaderType),
                border: "1px solid #c4ccd4",
                borderRadius: 6,
                fontSize: 12,
                whiteSpace: "pre-line",
                width: 280
            }
        })

        if(sp.tag)       ctx.byTag[sp.tag] = id
        if(sp.namespace) ctx.byNamespace[sp.namespace] = id

        if(parentId)
            ctx.parentEdges.push({ source: parentId, target: id, kind: "child" })

        ctx.taskRefs.push({ id, task })

        if(Array.isArray(task.children) && task.children.length > 0)
            _Walk(task.children, id, ctx)
    })
}

// Extrai dependências das regras (activationRules + agentLinkRules.requirement):
// uma cláusula { property: "params.tag"|"params.namespace", "=": <ref> } cria
// uma aresta do nó referenciado para o nó da task.
const _CollectDependencyEdges = (ctx:any) => {
    const edges:any[] = []
    const seen = new Set<string>()

    const addEdge = (sourceId:string, targetId:string) => {
        if(!sourceId || sourceId === targetId) return
        const key = `${sourceId}->${targetId}`
        if(seen.has(key)) return
        seen.add(key)
        edges.push({ source: sourceId, target: targetId, kind: "dep" })
    }

    const handleClauses = (rules:any, targetId:string) => {
        const and = (rules && rules["&&"]) || []
        and.forEach((clause:any) => {
            const value = clause["="]
            if(typeof value !== "string") return
            if(clause.property === "params.tag" && ctx.byTag[value])
                addEdge(ctx.byTag[value], targetId)
            else if(clause.property === "params.namespace" && ctx.byNamespace[value])
                addEdge(ctx.byNamespace[value], targetId)
        })
    }

    ctx.taskRefs.forEach(({ id, task }:any) => {
        handleClauses(task.activationRules, id)
        ;(task.agentLinkRules || []).forEach((rule:any) => handleClauses(rule.requirement, id))
    })

    return edges
}

const ConvertExecutionPlanToFlow = (executionParams:any[]) => {
    const ctx = {
        counter: 0,
        nodes: [] as any[],
        parentEdges: [] as any[],
        byTag: {} as any,
        byNamespace: {} as any,
        taskRefs: [] as any[]
    }

    _Walk(executionParams || [], null, ctx)

    const dependencyEdges = _CollectDependencyEdges(ctx)

    const edges = [...ctx.parentEdges, ...dependencyEdges].map((e:any, index:number) => ({
        id: `e${index}-${e.source}-${e.target}`,
        source: e.source,
        target: e.target,
        markerEnd: { type: MarkerType.ArrowClosed },
        animated: e.kind === "dep",
        label: e.kind === "child" ? "child" : "depends on",
        labelStyle: { fontSize: 11 },
        style: { stroke: e.kind === "child" ? "#9aa0a6" : "#6c63ff" }
    }))

    return { nodes: ctx.nodes, edges }
}

export default ConvertExecutionPlanToFlow
