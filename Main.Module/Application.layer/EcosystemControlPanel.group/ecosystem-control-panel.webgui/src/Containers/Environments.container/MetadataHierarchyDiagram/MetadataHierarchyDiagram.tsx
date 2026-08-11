import React, { useCallback, useEffect, useMemo } from "react"
import ReactFlow, {
	addEdge,
	ConnectionLineType,
	useNodesState,
	useEdgesState,
	Background,
	Controls,
} from "reactflow"
import "reactflow/dist/style.css"

import ConvertDependencyToFlowElements from "./ConvertDependencyToFlowElements"
import GetLayoutedElements from "../_shared/GetLayoutedElements"
import PackageFlowNode from "../_shared/PackageFlowNode"
import DiagramLegend from "../_shared/DiagramLegend"
import useNeighborHighlight from "../_shared/useNeighborHighlight"
import { CollectKinds } from "../_shared/DiagramTheme"

// A moldura do canvas vive em Styles/parts/environments.css (.ecp-flow-canvas):
// mesma altura/borda/fundo do antigo styled-component, agora em tokens --mp-*.

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
		<div className="ecp-flow-canvas ecp-flow-canvas--metadata react-flow-container">
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
		</div>
	)
}

export default MetadataHierarchyDiagram
