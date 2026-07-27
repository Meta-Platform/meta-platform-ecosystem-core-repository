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

import ConvertExecutionPlanToFlow from "./ConvertExecutionPlanToFlow"
import GetLayoutedElements from "../_shared/GetLayoutedElements"
import PackageFlowNode from "../_shared/PackageFlowNode"
import DiagramLegend from "../_shared/DiagramLegend"
import useNeighborHighlight from "../_shared/useNeighborHighlight"
import { CollectKinds } from "../_shared/DiagramTheme"

const DivFlowContainerStyled = styled.div`
  width: 100%;
  height: 720px;
  overflow: hidden;
  border: 1px solid #e3e6ea;
  border-radius: 8px;
  background: #fafbfc;
`

const nodeTypes = { pkg: PackageFlowNode }
const defaultEdgeOptions = { type: "smoothstep" }

const ExecutionPlanDiagram = ({ executionParams }:any) => {
	const [nodes, setNodes, onNodesChange] = useNodesState([])
	const [edges, setEdges, onEdgesChange] = useEdgesState([])

	useEffect(() => {
		if (executionParams) {
			const { nodes: initialNodes, edges: initialEdges } = ConvertExecutionPlanToFlow(executionParams)
			// dagre apenas posiciona; os conversores donam o estilo das arestas.
			const { nodes: layoutedNodes } = GetLayoutedElements(initialNodes, initialEdges, "TB")
			setNodes(layoutedNodes)
			setEdges(initialEdges)
		}
	}, [executionParams])

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
					relations={[
						{ label: "contém (child)", dashed: false, color: "#94a3b8" },
						{ label: "depende de", dashed: true, color: "#7c3aed" },
					]}
				/>
				<Background color="#e2e8f0" gap={18} />
			</ReactFlow>
		</DivFlowContainerStyled>
	)
}

export default ExecutionPlanDiagram
