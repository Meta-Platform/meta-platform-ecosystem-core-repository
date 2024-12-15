import React, { useCallback, useEffect } from "react"
import ReactFlow, {
	addEdge,
	ConnectionLineType,
	useNodesState,
	useEdgesState,
	Background,
	Controls,
} from "reactflow"
import styled from "styled-components"
import "reactflow/dist/style.css"
import ConvertDependencyToFlowElements from "./ConvertDependencyToFlowElements"
import dagre from "dagre"

const DivFlowContainerStyled = styled.div`
  width: 100%;
  height: 750px;
  overflow: hidden;
  border: 1px solid #eee;
`

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

const MetadataHierarchyDiagram = ({ metadataHierarchy }) => {
	const [nodes, setNodes, onNodesChange] = useNodesState([])
	const [edges, setEdges, onEdgesChange] = useEdgesState([])

	useEffect(() => {
		if (metadataHierarchy) {
			const { nodes: initialNodes, edges: initialEdges } = ConvertDependencyToFlowElements(metadataHierarchy)
			const { nodes, edges } = GetLayoutedElements(initialNodes, initialEdges, "TB")

			const styledNodes = nodes.map((node) => {
				let backgroundColor = "#fff"
				if (node.data.label.includes("webapp")) {
					backgroundColor = "#d1e7ff"
				} else if (node.data.label.includes("webservice")) {
					backgroundColor = "#d4edda"
				} else if (node.data.label.includes("webgui")) {
					backgroundColor = "#f8a0ff"
				} else if (node.data.label.includes("cli")) {
					backgroundColor = "#cbffe3"
				} else if (node.data.label.includes("app")) {
					backgroundColor = "#9fe5ff"
				} else if (node.data.label.includes("service")) {
					backgroundColor = "#ffcca0"
				} else if (node.data.label.includes("lib")) {
					backgroundColor = "#f8d7da"
				}
				return {
					...node,
					style: {
						...node.style,
						backgroundColor,
						border: "1px solid #ccc",
						width: 300,
					},
				}
			})

			setNodes(styledNodes)
			setEdges(edges)
		}
	}, [metadataHierarchy])

	const onConnect = useCallback(
		(params) =>
			setEdges((eds) =>
				addEdge(
					{
						...params,
						animated: true,
						style: { stroke: "#6c63ff" },
						label: "depends on",
						labelStyle: { fontSize: 12 },
					},
					eds
				)
			),
		[]
	)

	return (
		<DivFlowContainerStyled className="react-flow-container">
			<div style={{ width: "100%", height: "100%" }}>
				<ReactFlow
					nodes={nodes}
					edges={edges}
					onNodesChange={onNodesChange}
					onEdgesChange={onEdgesChange}
					onConnect={onConnect}
					connectionLineType={ConnectionLineType.SmoothStep}
					fitView
					fitViewOptions={{ padding: 0.2 }}>
					<Controls position="top-left" />
					<Background color="#eee" gap={16} />
				</ReactFlow>
			</div>
		</DivFlowContainerStyled>
	)
}

export default MetadataHierarchyDiagram
