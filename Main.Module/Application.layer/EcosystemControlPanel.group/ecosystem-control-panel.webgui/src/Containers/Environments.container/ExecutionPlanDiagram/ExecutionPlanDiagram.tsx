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

import ConvertExecutionPlanToFlow from "./ConvertExecutionPlanToFlow"
import GetLayoutedElements from "./GetLayoutedElements"

const DivFlowContainerStyled = styled.div`
  width: 100%;
  height: 720px;
  overflow: hidden;
  border: 1px solid #e3e6ea;
  border-radius: 8px;
  background: #fafbfc;
`

const ExecutionPlanDiagram = ({ executionParams }:any) => {
	const [nodes, setNodes, onNodesChange] = useNodesState([])
	const [edges, setEdges, onEdgesChange] = useEdgesState([])

	useEffect(() => {
		if (executionParams) {
			const { nodes: initialNodes, edges: initialEdges } = ConvertExecutionPlanToFlow(executionParams)
			// usa o dagre apenas para posicionar os nós; mantém as arestas
			// (child vs depends-on) com o estilo do conversor.
			const { nodes: layoutedNodes } = GetLayoutedElements(initialNodes, initialEdges, "TB")
			setNodes(layoutedNodes)
			setEdges(initialEdges)
		}
	}, [executionParams])

	const onConnect = useCallback(
		(params:any) => setEdges((eds:any) => addEdge({ ...params, animated: true }, eds)),
		[]
	)

	return (
		<DivFlowContainerStyled className="react-flow-container">
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
				<Background color="#e0e0e0" gap={16} />
			</ReactFlow>
		</DivFlowContainerStyled>
	)
}

export default ExecutionPlanDiagram
