import React, { useCallback, useEffect } from "react"
import ReactFlow, {
	addEdge,
	ConnectionLineType,
	useNodesState,
	useEdgesState,
	Background,
	useReactFlow,
	Controls,
} from "reactflow"
import styled from "styled-components"
import "reactflow/dist/style.css"
import ConvertDependencyToFlowElements from "./ConvertDependencyToFlowElements"

import GetLayoutedElements from "./GetLayoutedElements"

const DivFlowContainerStyled = styled.div`
  width: 100%;
  height: 750px;
  overflow: hidden;
  border: 1px solid #eee;
`

const MetadataHierarchyDiagram = ({ metadataHierarchy }) => {
	const [nodes, setNodes, onNodesChange] = useNodesState([])
	const [edges, setEdges, onEdgesChange] = useEdgesState([])

	useEffect(() => {
		if (metadataHierarchy) {
			const { nodes: initialNodes, edges: initialEdges } = ConvertDependencyToFlowElements(metadataHierarchy)
			const { nodes, edges } = GetLayoutedElements(initialNodes, initialEdges, "TB")

			const styledNodes = nodes.map((node) => {
				let backgroundColor = "#fff"
				const label = node.data.label
				
				if (label.endsWith(".webapp"))
					backgroundColor = "#d1e7ff"
				else if (label.endsWith(".webservice"))
					backgroundColor = "#d4edda"
				else if (label.endsWith(".webgui"))
					backgroundColor = "#f8a0ff"
				else if (label.endsWith(".cli"))
					backgroundColor = "#cbffe3"
				else if (label.endsWith(".app"))
					backgroundColor = "#9fe5ff"
				else if (label.endsWith(".service"))
					backgroundColor = "#ffcca0"
				else if (label.endsWith(".lib"))
					backgroundColor = "#f8d7da"

				return {
					...node,
					style: {
						...node.style,
						backgroundColor,
						border: "1px solid #ccc",
						width: 300,
					}
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