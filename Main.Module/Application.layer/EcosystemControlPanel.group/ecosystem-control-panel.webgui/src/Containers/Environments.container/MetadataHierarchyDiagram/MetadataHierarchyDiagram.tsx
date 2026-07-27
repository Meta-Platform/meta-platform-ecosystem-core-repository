import React, { useCallback, useEffect, useMemo } from "react"
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
import GetLayoutedElements from "../_shared/GetLayoutedElements"
import PackageFlowNode from "../_shared/PackageFlowNode"
import DiagramLegend from "../_shared/DiagramLegend"
import useNeighborHighlight from "../_shared/useNeighborHighlight"
import { CollectKinds } from "../_shared/DiagramTheme"

const DivFlowContainerStyled = styled.div`
  width: 100%;
  height: 750px;
  overflow: hidden;
  border: 1px solid #e3e6ea;
  border-radius: 8px;
  background: #fafbfc;
`

const nodeTypes = { pkg: PackageFlowNode }
const defaultEdgeOptions = { type: "smoothstep" }

const MetadataHierarchyDiagram = ({ metadataHierarchy }:any) => {
	const [nodes, setNodes, onNodesChange] = useNodesState([])
	const [edges, setEdges, onEdgesChange] = useEdgesState([])

	useEffect(() => {
		if (metadataHierarchy) {
			const { nodes: initialNodes, edges: initialEdges } = ConvertDependencyToFlowElements(metadataHierarchy)
			const { nodes: layoutedNodes } = GetLayoutedElements(initialNodes, initialEdges, "TB")
			setNodes(layoutedNodes)
			setEdges(initialEdges)
		}
	}, [metadataHierarchy])

	const { onNodeMouseEnter, onNodeMouseLeave } = useNeighborHighlight(edges, setNodes, setEdges)

	const kinds = useMemo(() => CollectKinds(nodes), [nodes])

	const onConnect = useCallback(
		(params:any) => setEdges((eds:any) => addEdge({ ...params, type: "smoothstep" }, eds)),
		[setEdges]
	)

	return (
		<DivFlowContainerStyled className="react-flow-container">
			<ReactFlow
				nodes={nodes}
				edges={edges}
				nodeTypes={nodeTypes}
				defaultEdgeOptions={defaultEdgeOptions}
				onNodesChange={onNodesChange}
				onEdgesChange={onEdgesChange}
				onConnect={onConnect}
				onNodeMouseEnter={onNodeMouseEnter}
				onNodeMouseLeave={onNodeMouseLeave}
				connectionLineType={ConnectionLineType.SmoothStep}
				minZoom={0.2}
				fitView
				fitViewOptions={{ padding: 0.2 }}>
				<Controls position="top-left" />
				<DiagramLegend
					kinds={kinds}
					relations={[{ label: "depende de", dashed: true, color: "#7c3aed" }]}
				/>
				<Background color="#e2e8f0" gap={18} />
			</ReactFlow>
		</DivFlowContainerStyled>
	)
}

export default MetadataHierarchyDiagram
