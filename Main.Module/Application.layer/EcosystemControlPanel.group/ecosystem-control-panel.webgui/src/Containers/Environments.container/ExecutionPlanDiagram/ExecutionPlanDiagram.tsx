import * as React from "react"
import { useMemo } from "react"

import { DiagramCanvas } from "@i-components/components/advanced/authoring"

import ConvertExecutionPlanToFlow from "./ConvertExecutionPlanToFlow"

// Plano de execução do ambiente, desenhado pelo `DiagramCanvas` do kit.
//
// Ver a nota do conversor ao lado sobre a divisão de trabalho: aqui não há mais
// tema, nó customizado, legenda nem layout — tudo isso é do kit, e a pintura
// segue os tokens do tema.
//
// A moldura (papel recuado, borda, sombra) é do próprio `.mp-diagram` do kit —
// a antiga `.ecp-flow-canvas` só repetia isso. Da folha do painel sobrou a
// ALTURA, que é decisão desta tela e por isso vem por prop.
const ExecutionPlanDiagram = ({ executionParams }:any) => {

    const { nodes, edges } = useMemo(
        () => executionParams
            ? ConvertExecutionPlanToFlow(executionParams)
            : { nodes: [], edges: [] },
        [executionParams])

    return <DiagramCanvas
        height={720}
        nodes={nodes}
        edges={edges}
        relationLabels={{ child: "contém (child)", dependency: "depende de" }}
        emptyTitle="Sem plano para desenhar"
        emptyMessage="Este ambiente ainda não tem tarefas no plano de execução."/>
}

export default ExecutionPlanDiagram
