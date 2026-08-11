import type { DiagramNodeInput, DiagramEdgeInput } from "@i-components/components/advanced/authoring"

// Converte a hierarquia de metadados do ambiente na forma NEUTRA que o
// `DiagramCanvas` do kit recebe. Este arquivo é o que resta de domínio: o
// desenho (nó, aresta, layout, legenda, realce de vizinhança) é do kit, e a
// COR de cada tipo sai de `useDiagramPalette()` — antes vinha da tabela de
// hexadecimais de `_shared/DiagramTheme.ts`, que era a razão de o diagrama ser
// a única superfície do painel que ignorava o tema.
//
// O tipo do pacote continua vindo do sufixo do namespace
// ("@/api-designer.webservice" -> "webservice"); quem faz essa leitura agora é
// o kit, por isso basta passar o `namespace`.

// Nós: 1 por item da dependencyList.
const ConvertDependencyListToNodes = (dependencyList: any[]): Map<string, DiagramNodeInput> =>
    dependencyList.reduce((nodesAcc: Map<string, DiagramNodeInput>, { code, dependency }: any) => {
        const { metadata } = dependency
        const namespace = metadata.package.namespace

        nodesAcc.set(code, {
            id    : code,
            label : namespace,
            namespace
        })

        return nodesAcc
    }, new Map())

// Arestas: percorre o linkedGraph (aninhado, chaves = codes) gerando uma aresta
// "depende de" (source -> target) para cada relação pai/filho.
const ConvertLinkedGraphToEdges = (linkedGraph: any): Map<string, DiagramEdgeInput> => {
    const edges = new Map<string, DiagramEdgeInput>()

    const _MountEdges = (graph: any) => {
        Object.keys(graph || {}).forEach((code) => {
            const childGraph = graph[code] || {}
            Object.keys(childGraph).forEach((childCode) => {
                const id = `e-${code}-${childCode}`
                if (!edges.has(id))
                    edges.set(id, { id, source: code, target: childCode, kind: "dependency" })
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
        edges: Array.from(edges.values())
    }
}

export default ConvertDependencyToFlowElements
