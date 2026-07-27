import { GetTheme, GetKindLabel, MakeEdge } from "../_shared/DiagramTheme"

// Nós: 1 por item da dependencyList, no formato do nó customizado "pkg".
// A cor vem do tipo do pacote (sufixo do namespace) — mesmo eixo do diagrama.
const ConvertDependencyListToNodes = (dependencyList: any[]) =>
    dependencyList.reduce((nodesAcc: Map<string, any>, { code, dependency }: any) => {
        const { metadata } = dependency
        const name = metadata.package.namespace

        nodesAcc.set(code, {
            id: code,
            type: "pkg",
            position: { x: 0, y: 0 },
            data: {
                name,
                typeLabel: GetKindLabel(name),
                kindLabel: GetKindLabel(name),
                theme: GetTheme(name),
            },
        })

        return nodesAcc
    }, new Map())

// Arestas: percorre o linkedGraph (aninhado, chaves = codes) gerando uma aresta
// "depende de" (source -> target) para cada relação pai/filho.
const ConvertLinkedGraphToEdges = (linkedGraph: any) => {
    const edges = new Map<string, any>()

    const _MountEdges = (graph: any) => {
        Object.keys(graph || {}).forEach((code) => {
            const childGraph = graph[code] || {}
            Object.keys(childGraph).forEach((childCode) => {
                const id = `e-${code}-${childCode}`
                if (!edges.has(id)) edges.set(id, MakeEdge(id, code, childCode, "dep"))
            })
            _MountEdges(childGraph)
        })
    }

    _MountEdges(linkedGraph)
    return edges
}

const ConvertDependencyToFlowElements = (metadataHierarchy: any) => {
    const { dependencyList, linkedGraph } = metadataHierarchy

    const nodes = ConvertDependencyListToNodes(dependencyList)
    const edges = ConvertLinkedGraphToEdges(linkedGraph)

    return {
        nodes: Array.from(nodes.values()),
        edges: Array.from(edges.values()),
    }
}

export default ConvertDependencyToFlowElements
