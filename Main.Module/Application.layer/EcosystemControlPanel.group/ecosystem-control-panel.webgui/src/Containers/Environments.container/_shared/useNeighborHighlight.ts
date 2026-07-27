import { useCallback } from "react"

// Realce de vizinhança: ao passar o mouse sobre um nó, mantém em destaque o nó
// e suas arestas/nós conectados e esmaece o restante — facilita seguir a cadeia
// de dependências num grafo denso.
const useNeighborHighlight = (edges: any[], setNodes: any, setEdges: any) => {
    const onNodeMouseEnter = useCallback(
        (_event: any, node: any) => {
            const id = node.id
            const connected = new Set<string>([id])
            edges.forEach((e) => {
                if (e.source === id) connected.add(e.target)
                if (e.target === id) connected.add(e.source)
            })

            setNodes((nds: any[]) =>
                nds.map((n) => ({
                    ...n,
                    style: { ...n.style, opacity: connected.has(n.id) ? 1 : 0.2 },
                }))
            )

            setEdges((eds: any[]) =>
                eds.map((e) => {
                    const active = e.source === id || e.target === id
                    return {
                        ...e,
                        animated: active && e.data?.kind === "dep",
                        style: { ...e.style, opacity: active ? 1 : 0.1 },
                        zIndex: active ? 10 : 0,
                    }
                })
            )
        },
        [edges, setNodes, setEdges]
    )

    const onNodeMouseLeave = useCallback(() => {
        setNodes((nds: any[]) => nds.map((n) => ({ ...n, style: { ...n.style, opacity: 1 } })))
        setEdges((eds: any[]) =>
            eds.map((e) => ({
                ...e,
                animated: e.data?.kind === "dep",
                style: { ...e.style, opacity: 1 },
                zIndex: 0,
            }))
        )
    }, [setNodes, setEdges])

    return { onNodeMouseEnter, onNodeMouseLeave }
}

export default useNeighborHighlight
