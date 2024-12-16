import dagre from "dagre"

const nodeWidth = 300
const nodeHeight = 50

const GetLayoutedElements = (nodes, edges, direction = "TB") => {
	const dagreGraph = new dagre.graphlib.Graph()
	dagreGraph.setDefaultEdgeLabel(() => ({}))

	dagreGraph.setGraph({ rankdir: direction, marginx: 50, marginy: 50 })

	nodes.forEach((node) => {
		dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight })
	})

	edges.forEach((edge) => {
		dagreGraph.setEdge(edge.source, edge.target)
	})

	dagre.layout(dagreGraph)

	const layoutedNodes = nodes.map((node) => {
		const nodeWithPosition = dagreGraph.node(node.id)
		node.targetPosition = "top"
		node.sourcePosition = "bottom"
		node.position = {
			x: nodeWithPosition.x - nodeWidth / 2,
			y: nodeWithPosition.y - nodeHeight / 2,
		}
		return node
	})

	const adjustedEdges = edges.map((edge) => ({
		...edge,
		animated: true,
		label: "depends on",
		labelStyle: { fontSize: 12 },
		style: { stroke: "#6c63ff" },
	}))

	return { nodes: layoutedNodes, edges: adjustedEdges }
}

export default GetLayoutedElements