import * as React from "react"
import { useMemo } from "react"

import { DiagramCanvas } from "@i-components/components/advanced/authoring"

import ConvertDependencyToFlowElements from "./ConvertDependencyToFlowElements"

// Hierarquia de metadados do ambiente, desenhada pelo `DiagramCanvas` do kit.
//
// Antes daqui saíam ~340 linhas espalhadas por `_shared/` (tema em hexadecimal,
// nó customizado, legenda, layout com dagre, realce de vizinhança). Tudo isso é
// do kit agora; sobrou o conversor ao lado, que é o que sabe o que é uma
// hierarquia de metadados.
//
// A moldura (papel recuado, borda, sombra) é do próprio `.mp-diagram` do kit —
// a antiga `.ecp-flow-canvas` só repetia isso. Da folha do painel sobrou a
// ALTURA, que é decisão desta tela e por isso vem por prop.
const MetadataHierarchyDiagram = ({ metadataHierarchy }:any) => {

    const { nodes, edges } = useMemo(
        () => metadataHierarchy
            ? ConvertDependencyToFlowElements(metadataHierarchy)
            : { nodes: [], edges: [] },
        [metadataHierarchy])

    return <DiagramCanvas
        height={750}
        nodes={nodes}
        edges={edges}
        emptyTitle="Sem hierarquia para desenhar"
        emptyMessage="Este ambiente não declarou dependências de metadados."/>
}

export default MetadataHierarchyDiagram
