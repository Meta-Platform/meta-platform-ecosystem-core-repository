import type { DiagramNodeInput, DiagramEdgeInput } from "@i-components/components/advanced/authoring"

// Converte o plano de execução do ambiente na forma NEUTRA que o
// `DiagramCanvas` do kit recebe. É o que resta de domínio: o desenho (nó,
// aresta, layout, legenda, realce de vizinhança) é do kit, e a COR de cada tipo
// sai de `useDiagramPalette()` em vez da tabela de hexadecimais que morava em
// `_shared/DiagramTheme.ts`.
//
// Duas informações diferentes convivem em cada nó, e é de propósito:
//   - o TIPO DO PACOTE (sufixo do namespace) dá a cor e a entrada na legenda —
//     o mesmo eixo da aba de hierarquia, para o mesmo pacote ter a mesma cor
//     nas duas;
//   - o PAPEL DE EXECUÇÃO (objectLoaderType) vai na segunda linha do cartão,
//     porque é o que diferencia duas tasks do mesmo pacote.

// Rótulo curto do papel de execução (objectLoaderType).
const LOADER_LABEL: Record<string, string> = {
    "install-nodejs-package-dependencies": "install deps",
    "nodejs-package"                     : "package",
    "application-instance"               : "app instance",
    "service-instance"                   : "service instance",
    "endpoint-instance"                  : "endpoint",
    "command-application"                : "command"
}

const GetTaskName = (task: any) => {
    const sp = task.staticParameters || {}
    return sp.namespace || sp.tag || sp.url || sp.name || task.objectLoaderType
}

// Percorre o plano (incluindo children) atribuindo ids estáveis e montando:
//  - nós (1 por task)
//  - índices por tag e por namespace (para resolver dependências de ativação)
//  - arestas pai->filho (children)
const _Walk = (tasks: any[], parentId: string | null, ctx: any) => {
    tasks.forEach((task: any) => {
        const id = `t${ctx.counter++}`
        const sp = task.staticParameters || {}
        const name = GetTaskName(task)

        ctx.nodes.push({
            id,
            label     : name,
            namespace : name,
            sublabel  : LOADER_LABEL[task.objectLoaderType] || task.objectLoaderType
        } as DiagramNodeInput)

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
        edges.push({ source: sourceId, target: targetId, kind: "dependency" })
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
        nodes: [] as DiagramNodeInput[],
        parentEdges: [] as any[],
        byTag: {} as any,
        byNamespace: {} as any,
        taskRefs: [] as any[]
    }

    _Walk(executionParams || [], null, ctx)

    const dependencyEdges = _CollectDependencyEdges(ctx)

    const edges: DiagramEdgeInput[] = [...ctx.parentEdges, ...dependencyEdges]
        .map((edge: any, index: number) => ({
            id     : `e${index}-${edge.source}-${edge.target}`,
            source : edge.source,
            target : edge.target,
            kind   : edge.kind
        }))

    return { nodes: ctx.nodes, edges }
}

export default ConvertExecutionPlanToFlow
