import * as React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import ReactFlow, {
    Background, ConnectionLineType, Controls, Handle, MarkerType, MiniMap,
    Panel as FlowPanel, Position, ReactFlowProvider,
    useEdgesState, useNodesInitialized, useNodesState, useReactFlow
} from "reactflow"
import type { NodeTypes } from "reactflow"
import dagre from "dagre"

import Icon from "../Icon"
import { useDiagramPalette } from "../../theme/palette"
import type { DiagramKind, DiagramPalette } from "../../theme/palette"

// Canvas de grafo do design system (reactflow + dagre).
//
// Existia, antes, três vezes: dois diagramas no Ecosystem Control Panel
// (hierarquia de metadados e plano de execução) e o diagrama de runtime do
// Package Developer. Cada cópia trazia a SUA tabela de cores em hexadecimal
// (`#dbeafe`, `#3b82f6`, `#7c3aed`…) — cores que não existem em token nenhum.
// O resultado é que o diagrama era a única superfície da plataforma que
// ignorava o tema: trocar para "dark" escurecia tudo, menos o grafo.
//
// Aqui a pintura sai INTEIRA de `useDiagramPalette()`, que lê os tokens --mp-*
// do documento e é recalculada quando `data-theme` muda. Um nó é superfície
// plana + borda de acento do TIPO + texto tinta (ver a nota de desenho em
// theme/palette.ts sobre por que não há tinta pastel de fundo).
//
// O componente é do kit: não conhece pacote, boot nem plano de execução. Recebe
// nós e arestas em forma neutra e devolve o clique por callback.

/* ------------------------------------------------------------------ */
/* Contrato de entrada                                                */
/* ------------------------------------------------------------------ */

export type DiagramDirection = "TB" | "LR"

// Relação entre dois nós. O significado é comunicado por ESTILO DE LINHA
// (sólida/tracejada) além da cor — cor sozinha não é sinal acessível.
export type DiagramEdgeKind = "child" | "dependency" | "highlight"

export interface DiagramNodeInput {
    id: string
    label: string
    // segunda linha do cartão (caminho, versão, endereço…)
    sublabel?: string
    // tipo do nó: define a cor da borda e a entrada na legenda.
    kind?: DiagramKind
    // alternativa ao `kind`: "@/api-designer.webservice" -> "webservice".
    namespace?: string
    // rótulo do tipo escrito no nó; por padrão, o rótulo do próprio kind.
    typeLabel?: string
    // nome de ícone do kit (ver Icon) desenhado no topo do cartão.
    icon?: string
    // tamanho próprio, quando este nó destoa dos demais (alimenta o dagre).
    width?: number
    height?: number
    // devolvido intacto em onSelectNode — é como o aplicativo religa o nó ao
    // seu domínio sem que o canvas precise conhecê-lo.
    payload?: any
}

export interface DiagramEdgeInput {
    id?: string
    source: string
    target: string
    kind?: DiagramEdgeKind
    label?: string
}

export interface DiagramCanvasProps {
    nodes: DiagramNodeInput[]
    edges?: DiagramEdgeInput[]
    // direção do layout. Passar junto com onDirectionChange torna-a controlada.
    direction?: DiagramDirection
    onDirectionChange?: (direction: DiagramDirection) => void
    // botão de direção na barra do canvas.
    directionToggle?: boolean
    // nó em foco (vem da seleção do aplicativo): destaca-o e esmaece o resto.
    selectedId?: string
    onSelectNode?: (id: string, payload: any) => void
    legend?: boolean
    minimap?: boolean
    controls?: boolean
    // tamanho padrão do nó; o dagre precisa dele para não sobrepor cartões.
    nodeSize?: { width: number, height: number }
    // texto de cada relação na legenda.
    relationLabels?: { [kind in DiagramEdgeKind]?: string }
    height?: number | string
    emptyTitle?: string
    emptyMessage?: string
    className?: string
}

/* ------------------------------------------------------------------ */
/* Estilo derivado dos tokens                                         */
/* ------------------------------------------------------------------ */

const RELATION_LABEL: { [kind in DiagramEdgeKind]: string } = {
    child      : "contém",
    dependency : "depende de",
    highlight  : "em destaque"
}

interface EdgeStroke { color: string, dashed: boolean, animated: boolean }

const EdgeStrokeOf = (kind: DiagramEdgeKind, diagram: DiagramPalette): EdgeStroke => {
    if(kind === "child")     return { color: diagram.edge.child,      dashed: false, animated: false }
    if(kind === "highlight") return { color: diagram.edge.highlight,  dashed: false, animated: true }
    return { color: diagram.edge.dependency, dashed: true, animated: true }
}

/* ------------------------------------------------------------------ */
/* Nó                                                                 */
/* ------------------------------------------------------------------ */

// data: { label, sublabel, typeLabel, accent, icon, width, dimmed, highlighted, clickable }
const DiagramFlowNode = React.memo(({ data }: any) => {
    const handleStyle = { background: data.accent, width: 7, height: 7, border: "none" }
    const classes = [
        "mp-diagram__node",
        data.highlighted ? "is-highlighted" : "",
        data.dimmed ? "is-dimmed" : "",
        data.clickable ? "is-clickable" : ""
    ].filter(Boolean).join(" ")

    return <div
        className={classes}
        style={{ borderColor: data.accent, width: data.width }}
        title={data.sublabel ? `${data.label}\n${data.sublabel}` : data.label}>

        <Handle type="target" position={data.targetPosition || Position.Top} style={handleStyle}/>

        <div className="mp-diagram__node-top">
            { data.icon && <Icon name={data.icon} style={{ color: data.accent }}/> }
            { data.typeLabel &&
                <span className="mp-diagram__node-kind" style={{ borderColor: data.accent, color: data.accent }}>
                    {data.typeLabel}
                </span> }
        </div>

        <div className="mp-diagram__node-label">{data.label}</div>
        { data.sublabel && <div className="mp-diagram__node-sub">{data.sublabel}</div> }

        <Handle type="source" position={data.sourcePosition || Position.Bottom} style={handleStyle}/>
    </div>
})

// A asserção existe por causa de uma incompatibilidade entre versões dos tipos
// do React, e não do reactflow: sob `@types/react@19` o retorno de um
// `MemoExoticComponent` é `ReactNode`, que passou a incluir `bigint`, enquanto
// `NodeTypes` do reactflow 11 espera `ReactElement | null`. Sem isto o kit
// compila com os tipos 18 e QUEBRA em qualquer ambiente onde algum pacote
// arraste os tipos 19 por transitividade — foi o que aconteceu no ambiente do
// server-manager, via o `*` de `@types/react-redux`.
const nodeTypes = { mp: DiagramFlowNode } as NodeTypes

/* ------------------------------------------------------------------ */
/* Layout (dagre)                                                     */
/* ------------------------------------------------------------------ */

const DEFAULT_SIZE = { width: 220, height: 80 }

// Só POSICIONA: cor e forma já vieram da paleta. Espaçamento generoso porque
// grafo apertado vira emaranhado de linhas, e aí o diagrama não serve para nada.
export const LayoutDiagram = (
    nodes: DiagramNodeInput[],
    edges: DiagramEdgeInput[],
    direction: DiagramDirection,
    diagram: DiagramPalette,
    size = DEFAULT_SIZE
) => {
    const graph = new dagre.graphlib.Graph()
    graph.setDefaultEdgeLabel(() => ({}))
    graph.setGraph({
        rankdir : direction,
        ranksep : 90,
        nodesep : 45,
        edgesep : 22,
        marginx : 40,
        marginy : 40
    })

    const sizeOf = (node: DiagramNodeInput) => ({
        width  : node.width  || size.width,
        height : node.height || size.height
    })

    nodes.forEach((node) => graph.setNode(node.id, sizeOf(node)))
    edges.forEach((edge) => {
        if(edge.source !== edge.target) graph.setEdge(edge.source, edge.target)
    })
    dagre.layout(graph)

    const horizontal = direction === "LR"
    const targetPosition = horizontal ? Position.Left : Position.Top
    const sourcePosition = horizontal ? Position.Right : Position.Bottom

    const flowNodes = nodes.map((node) => {
        const kind = node.kind || diagram.kindOf(node.namespace || "")
        const style = diagram.node(kind)
        const point = graph.node(node.id) || { x: 0, y: 0 }
        const box = sizeOf(node)
        return {
            id       : node.id,
            type     : "mp",
            position : { x: point.x - box.width / 2, y: point.y - box.height / 2 },
            targetPosition,
            sourcePosition,
            data     : {
                label     : node.label,
                sublabel  : node.sublabel,
                typeLabel : node.typeLabel !== undefined ? node.typeLabel : style.label,
                accent    : style.border,
                icon      : node.icon,
                width     : box.width,
                kind,
                payload   : node.payload,
                targetPosition,
                sourcePosition
            }
        }
    })

    const flowEdges = edges.map((edge, index) => {
        const kind = edge.kind || "dependency"
        const stroke = EdgeStrokeOf(kind, diagram)
        return {
            id        : edge.id || `${edge.source}->${edge.target}#${index}`,
            source    : edge.source,
            target    : edge.target,
            type      : "smoothstep",
            label     : edge.label,
            data      : { kind },
            animated  : stroke.animated,
            markerEnd : { type: MarkerType.ArrowClosed, color: stroke.color, width: 16, height: 16 },
            labelStyle      : { fill: diagram.textMuted, fontSize: 10, fontFamily: diagram.fontMono },
            labelBgStyle    : { fill: diagram.background },
            labelBgPadding  : [ 4, 2 ] as [ number, number ],
            style     : {
                stroke      : stroke.color,
                strokeWidth : 1.6,
                ...(stroke.dashed ? { strokeDasharray: "6 4" } : {})
            }
        }
    })

    return { nodes: flowNodes, edges: flowEdges }
}

/* ------------------------------------------------------------------ */
/* Legenda                                                            */
/* ------------------------------------------------------------------ */

// Legenda só com o que está NA TELA — herdado do CollectKinds do control panel.
// Legenda que lista o catálogo inteiro deixa de ser legenda e vira tabela.
const CollectLegend = (flowNodes: any[], flowEdges: any[]) => {
    const kinds: { label: string, accent: string }[] = []
    flowNodes.forEach((node) => {
        const label = node.data && node.data.typeLabel
        if(!label || kinds.some((item) => item.label === label)) return
        kinds.push({ label, accent: node.data.accent })
    })

    const relations: DiagramEdgeKind[] = []
    flowEdges.forEach((edge) => {
        const kind = edge.data && edge.data.kind
        if(kind && relations.indexOf(kind) < 0) relations.push(kind)
    })

    return { kinds, relations }
}

/* ------------------------------------------------------------------ */
/* Canvas                                                             */
/* ------------------------------------------------------------------ */

const FIT_OPTIONS = { padding: 0.16, maxZoom: 1, duration: 0 }

const Canvas = (props: DiagramCanvasProps & { direction: DiagramDirection, onDirection: (d: DiagramDirection) => void }) => {

    const {
        nodes: inputNodes, edges: inputEdges = [], direction, onDirection, directionToggle = true,
        selectedId, onSelectNode, legend = true, minimap = false, controls = true,
        nodeSize, relationLabels
    } = props

    const diagram = useDiagramPalette()
    const layout = useMemo(
        () => LayoutDiagram(inputNodes, inputEdges, direction, diagram, nodeSize || DEFAULT_SIZE),
        [ inputNodes, inputEdges, direction, diagram, nodeSize ])

    const [ nodes, setNodes, onNodesChange ] = useNodesState(layout.nodes as any)
    const [ edges, setEdges, onEdgesChange ] = useEdgesState(layout.edges as any)
    const [ hoverId, setHoverId ] = useState<string | undefined>(undefined)
    const { fitView } = useReactFlow()
    const nodesInitialized = useNodesInitialized()

    // Trocar o tema recria `diagram` e, com ele, o layout inteiro já pintado.
    useEffect(() => {
        setNodes(layout.nodes as any)
        setEdges(layout.edges as any)
    }, [ layout ])

    // Realce de vizinhança: o nó em foco e seus vizinhos ficam nítidos, o resto
    // esmaece. É o que torna legível um grafo denso de dependências.
    const focusId = hoverId || selectedId
    useEffect(() => {
        const near: { [id: string]: boolean } = {}
        if(focusId){
            near[focusId] = true
            layout.edges.forEach((edge: any) => {
                if(edge.source === focusId) near[edge.target] = true
                if(edge.target === focusId) near[edge.source] = true
            })
        }
        setNodes((current: any[]) => current.map((node) => ({
            ...node,
            data: {
                ...node.data,
                dimmed      : !!focusId && !near[node.id],
                highlighted : !!focusId && node.id === focusId,
                clickable   : !!onSelectNode
            }
        })))
        setEdges((current: any[]) => current.map((edge: any) => ({
            ...edge,
            style: {
                ...edge.style,
                opacity: !focusId || edge.source === focusId || edge.target === focusId ? 1 : 0.15
            }
        })))
    }, [ focusId, layout, onSelectNode ])

    // fitView antes da medição dos nós é ignorado pelo reactflow — daí o hook,
    // e não um setTimeout na esperança de que já tenha medido.
    useEffect(() => {
        if(nodesInitialized) fitView(FIT_OPTIONS)
    }, [ nodesInitialized, layout ])

    const onNodeClick = useCallback((_event: any, node: any) => {
        if(onSelectNode) onSelectNode(node.id, node.data && node.data.payload)
    }, [ onSelectNode ])

    const marks = useMemo(() => CollectLegend(layout.nodes, layout.edges), [ layout ])
    const labelOfRelation = (kind: DiagramEdgeKind) =>
        (relationLabels && relationLabels[kind]) || RELATION_LABEL[kind]

    return <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeMouseEnter={(_e: any, node: any) => setHoverId(node.id)}
        onNodeMouseLeave={() => setHoverId(undefined)}
        onPaneClick={() => setHoverId(undefined)}
        connectionLineType={ConnectionLineType.SmoothStep}
        nodesConnectable={false}
        minZoom={0.15}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}>

        { controls && <Controls position="bottom-left" showInteractive={false}/> }

        { minimap &&
            <MiniMap
                position="bottom-right"
                pannable
                zoomable
                style={{ background: diagram.background, border: `1px solid ${diagram.grid}` }}
                nodeColor={(node: any) => (node.data && node.data.accent) || diagram.edge.child}/> }

        { directionToggle &&
            <FlowPanel position="top-left">
                <div className="mp-diagram__tools">
                    <button
                        type="button"
                        className="mp-diagram__tool"
                        title="Ajustar o grafo à tela"
                        onClick={() => fitView({ ...FIT_OPTIONS, duration: 200 })}>
                        <Icon name="expand"/> Ajustar
                    </button>
                    <button
                        type="button"
                        className="mp-diagram__tool"
                        title="Alternar a direção do layout"
                        onClick={() => onDirection(direction === "TB" ? "LR" : "TB")}>
                        <Icon name={direction === "TB" ? "arrow down" : "arrow right"}/>
                        { direction === "TB" ? "Vertical" : "Horizontal" }
                    </button>
                </div>
            </FlowPanel> }

        { legend && (marks.kinds.length > 0 || marks.relations.length > 0) &&
            <FlowPanel position="top-right">
                <div className="mp-diagram__legend">
                    <div className="mp-diagram__legend-title">Legenda</div>
                    { marks.kinds.map((kind) =>
                        <div className="mp-diagram__legend-row" key={kind.label}>
                            <span className="mp-diagram__legend-swatch" style={{ borderColor: kind.accent }}/>
                            <span>{kind.label}</span>
                        </div>) }
                    { marks.relations.length > 0 &&
                        <div className="mp-diagram__legend-group">
                            { marks.relations.map((kind) => {
                                const stroke = EdgeStrokeOf(kind, diagram)
                                return <div className="mp-diagram__legend-row" key={kind}>
                                    <span
                                        className="mp-diagram__legend-line"
                                        style={{ borderTop: `2px ${stroke.dashed ? "dashed" : "solid"} ${stroke.color}` }}/>
                                    <span>{labelOfRelation(kind)}</span>
                                </div>
                            }) }
                        </div> }
                </div>
            </FlowPanel> }

        <Background color={diagram.grid} gap={18}/>
    </ReactFlow>
}

/* ------------------------------------------------------------------ */
/* Componente público                                                 */
/* ------------------------------------------------------------------ */

export const DiagramCanvas = (props: DiagramCanvasProps) => {

    const {
        nodes, height = 460, className = "",
        emptyTitle = "Nada para desenhar",
        emptyMessage = "Não há nós suficientes para montar um diagrama.",
        direction, onDirectionChange
    } = props

    // Direção pode ser controlada pelo aplicativo (direction + onDirectionChange)
    // ou ficar por conta do canvas — o botão precisa funcionar nos dois casos.
    const [ ownDirection, setOwnDirection ] = useState<DiagramDirection>(direction || "TB")
    const current = direction !== undefined && onDirectionChange ? direction : ownDirection
    const setDirection = (next: DiagramDirection) => {
        setOwnDirection(next)
        if(onDirectionChange) onDirectionChange(next)
    }

    const style = { height: typeof height === "number" ? `${height}px` : height }

    if(!nodes || nodes.length === 0)
        return <div className={`mp-diagram mp-diagram--empty ${className}`} style={style}>
            <Icon name="sitemap" size="big"/>
            <div className="mp-diagram__empty-title">{emptyTitle}</div>
            <div className="mp-diagram__empty-message">{emptyMessage}</div>
        </div>

    return <div className={`mp-diagram ${className}`} style={style}>
        <ReactFlowProvider>
            <Canvas {...props} direction={current} onDirection={setDirection}/>
        </ReactFlowProvider>
    </div>
}

export default DiagramCanvas
