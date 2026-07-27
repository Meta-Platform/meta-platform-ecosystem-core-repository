import dagre from "dagre"

// Layout automático (Dagre). Apenas POSICIONA os nós — o estilo das arestas é
// responsabilidade dos conversores. Espaçamento generoso (ranksep/nodesep) e
// tamanho de nó realista evitam sobreposição de nós e cruzamento de linhas.
const NODE_W = 240
const NODE_H = 76

const GetLayoutedElements = (nodes: any[], edges: any[], direction = "TB") => {
    const dagreGraph = new dagre.graphlib.Graph()
    dagreGraph.setDefaultEdgeLabel(() => ({}))

    dagreGraph.setGraph({
        rankdir: direction,
        ranksep: 90,
        nodesep: 55,
        edgesep: 25,
        marginx: 40,
        marginy: 40,
    })

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: NODE_W, height: NODE_H })
    })

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target)
    })

    dagre.layout(dagreGraph)

    const horizontal = direction === "LR" || direction === "RL"

    const layoutedNodes = nodes.map((node) => {
        const p = dagreGraph.node(node.id)
        return {
            ...node,
            targetPosition: horizontal ? "left" : "top",
            sourcePosition: horizontal ? "right" : "bottom",
            position: { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 },
        }
    })

    return { nodes: layoutedNodes, edges }
}

export default GetLayoutedElements
