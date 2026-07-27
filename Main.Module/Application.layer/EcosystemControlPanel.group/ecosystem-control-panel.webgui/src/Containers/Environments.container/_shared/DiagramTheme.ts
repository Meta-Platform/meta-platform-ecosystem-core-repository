import { MarkerType } from "reactflow"

// ---------------------------------------------------------------------------
// Tema compartilhado dos diagramas do Environment (diagram + metadata hierarchy).
// A COR do nó é o eixo unificado entre as duas abas: ela representa o TIPO DE
// PACOTE, derivado do sufixo do namespace (@/nome.webservice -> "webservice").
// Assim o mesmo pacote tem a mesma cor nas duas abas.
// ---------------------------------------------------------------------------

export interface Theme {
    bg: string
    border: string
    label: string
}

// Paleta coerente (tons pastel + borda saturada), legível com texto escuro.
export const KIND_THEME: Record<string, Theme> = {
    webapp     : { bg: "#dbeafe", border: "#3b82f6", label: "Web App" },
    webservice : { bg: "#dcfce7", border: "#22c55e", label: "Web Service" },
    webgui     : { bg: "#ede9fe", border: "#8b5cf6", label: "Web GUI" },
    desktopapp : { bg: "#e0f2fe", border: "#0ea5e9", label: "Desktop App" },
    app        : { bg: "#cffafe", border: "#06b6d4", label: "App" },
    cli        : { bg: "#ccfbf1", border: "#14b8a6", label: "CLI" },
    service    : { bg: "#fef3c7", border: "#f59e0b", label: "Service" },
    lib        : { bg: "#ffe4e6", border: "#f43f5e", label: "Library" },
}

export const DEFAULT_THEME: Theme = { bg: "#f1f5f9", border: "#94a3b8", label: "Outros" }

// Extrai o tipo (sufixo) do namespace: "@/api-designer.webservice" -> "webservice".
// Retorna null quando não há sufixo reconhecível (ex.: instâncias "/api-designer").
export const GetPackageKind = (namespace: string): string | null => {
    if (typeof namespace !== "string") return null
    const match = namespace.match(/\.([a-zA-Z]+)$/)
    if (!match) return null
    const kind = match[1].toLowerCase()
    return KIND_THEME[kind] ? kind : null
}

export const GetTheme = (namespace: string): Theme => {
    const kind = GetPackageKind(namespace)
    return (kind && KIND_THEME[kind]) || DEFAULT_THEME
}

export const GetKindLabel = (namespace: string): string => GetTheme(namespace).label

// Reúne os tipos de nó presentes (para montar a legenda só com o que aparece).
export const CollectKinds = (nodes: any[]): { label: string; theme: Theme }[] => {
    const seen = new Map<string, Theme>()
    ;(nodes || []).forEach((n) => {
        const t: Theme = n?.data?.theme
        const label: string = n?.data?.kindLabel
        if (t && label && !seen.has(label)) seen.set(label, t)
    })
    return Array.from(seen.entries()).map(([label, theme]) => ({ label, theme }))
}

// ---------------------------------------------------------------------------
// Arestas: a relação é comunicada por ESTILO DE LINHA + seta (sem texto).
//   child -> linha sólida cinza   (hierarquia pai/filho)
//   dep   -> linha tracejada roxa (depende de), animada
// ---------------------------------------------------------------------------

export type EdgeKind = "child" | "dep"

interface EdgeStyle { stroke: string; dashed: boolean; animated: boolean }

export const EDGE_STYLE: Record<EdgeKind, EdgeStyle> = {
    child : { stroke: "#94a3b8", dashed: false, animated: false },
    dep   : { stroke: "#7c3aed", dashed: true,  animated: true  },
}

export const MakeEdge = (id: string, source: string, target: string, kind: EdgeKind) => {
    const s = EDGE_STYLE[kind] || EDGE_STYLE.dep
    return {
        id,
        source,
        target,
        type: "smoothstep",
        data: { kind },
        animated: s.animated,
        markerEnd: { type: MarkerType.ArrowClosed, color: s.stroke, width: 18, height: 18 },
        style: {
            stroke: s.stroke,
            strokeWidth: 1.5,
            ...(s.dashed ? { strokeDasharray: "6 4" } : {}),
        },
    }
}
