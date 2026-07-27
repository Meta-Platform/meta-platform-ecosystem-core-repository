import { GetTheme, GetKindLabel, MakeEdge } from "../_shared/DiagramTheme"

// Rótulo curto do papel de execução (objectLoaderType) mostrado no chip do nó.
const LOADER_LABEL: Record<string, string> = {
    "install-nodejs-package-dependencies": "install deps",
    "nodejs-package"                     : "package",
    "application-instance"               : "app instance",
    "service-instance"                   : "service instance",
    "endpoint-instance"                  : "endpoint",
    "command-application"                : "command",
}

const GetTaskName = (task: any) => {
    const sp = task.staticParameters || {}
    return sp.namespace || sp.tag || sp.url || sp.name || task.objectLoaderType
}

// Percorre o plano (incluindo children) atribuindo ids estáveis e montando:
//  - nós (1 por task) no formato do nó customizado "pkg"
//  - índices por tag e por namespace (para resolver dependências de ativação)
//  - arestas pai->filho (children)
const _Walk = (tasks: any[], parentId: string | null, ctx: any) => {
    tasks.forEach((task: any) => {
        const id = `t${ctx.counter++}`
        const sp = task.staticParameters || {}
        const name = GetTaskName(task)

        ctx.nodes.push({
            id,
            type: "pkg",
            position: { x: 0, y: 0 },
            data: {
                name,
                typeLabel: LOADER_LABEL[task.objectLoaderType] || task.objectLoaderType,
                kindLabel: GetKindLabel(name),
                theme: GetTheme(name),
            },
        })

        if (sp.tag)       ctx.byTag[sp.tag] = id
        if (sp.namespace) ctx.byNamespace[sp.namespace] = id

        if (parentId)
            ctx.parentEdges.push({ source: parentId, target: id, kind: "child" })

        ctx.taskRefs.push({ id, task })

        if (Array.isArray(task.children) && task.children.length > 0)
            _Walk(task.children, id, ctx)
    })
}

// Extrai dependências das regras (activationRules + agentLinkRules.requirement):
// uma cláusula { property: "params.tag"|"params.namespace", "=": <ref> } cria
// uma aresta do nó referenciado para o nó da task.
const _CollectDependencyEdges = (ctx: any) => {
    const edges: any[] = []
    const seen = new Set<string>()

    const addEdge = (sourceId: string, targetId: string) => {
        if (!sourceId || sourceId === targetId) return
        const key = `${sourceId}->${targetId}`
        if (seen.has(key)) return
        seen.add(key)
        edges.push({ source: sourceId, target: targetId, kind: "dep" })
    }

    const handleClauses = (rules: any, targetId: string) => {
        const and = (rules && rules["&&"]) || []
        and.forEach((clause: any) => {
            const value = clause["="]
            if (typeof value !== "string") return
            if (clause.property === "params.tag" && ctx.byTag[value])
                addEdge(ctx.byTag[value], targetId)
            else if (clause.property === "params.namespace" && ctx.byNamespace[value])
                addEdge(ctx.byNamespace[value], targetId)
        })
    }

    ctx.taskRefs.forEach(({ id, task }: any) => {
        handleClauses(task.activationRules, id)
        ;(task.agentLinkRules || []).forEach((rule: any) => handleClauses(rule.requirement, id))
    })

    return edges
}

const ConvertExecutionPlanToFlow = (executionParams: any[]) => {
    const ctx = {
        counter: 0,
        nodes: [] as any[],
        parentEdges: [] as any[],
        byTag: {} as any,
        byNamespace: {} as any,
        taskRefs: [] as any[],
    }

    _Walk(executionParams || [], null, ctx)

    const dependencyEdges = _CollectDependencyEdges(ctx)

    const edges = [...ctx.parentEdges, ...dependencyEdges].map((e: any, index: number) =>
        MakeEdge(`e${index}-${e.source}-${e.target}`, e.source, e.target, e.kind)
    )

    return { nodes: ctx.nodes, edges }
}

export default ConvertExecutionPlanToFlow
