import * as React from "react"
import { useState } from "react"

import type { ComponentStory } from "./types"
import { DiagramCanvas } from "../components/advanced/DiagramCanvas"
import { MarkdownView, RenderMarkdown } from "../components/advanced/MarkdownView"
import { MarkdownEditor } from "../components/advanced/MarkdownEditor"
import { CodeEditor, GuessLanguage } from "../components/advanced/CodeEditor"

// Histórias dos componentes pesados de autoria (DiagramCanvas, MarkdownView,
// MarkdownEditor, CodeEditor). Agregadas por `stories.tsx` na coleção do kit.

const SOURCE = "@/i-components.uilib"

const Story = (story: Omit<ComponentStory, "sourcePackage">): ComponentStory => ({
    sourcePackage: SOURCE,
    importFrom: "@i-components",
    status: "stable",
    ...story
})

/* ------------------------------------------------------------------ */
/* DiagramCanvas                                                      */
/* ------------------------------------------------------------------ */

// Um grafo pequeno, mas com os dois tipos de aresta e vários tipos de nó — é o
// que faz a legenda mostrar alguma coisa e o realce de vizinhança ter efeito.
const DIAGRAM_NODES = [
    { id: "app",     label: "meta-project-manager", sublabel: "@/meta-project-manager.desktopapp", namespace: "@/x.desktopapp", icon: "desktop" },
    { id: "gui",     label: "meta-project-manager", sublabel: "@/meta-project-manager.webgui",     namespace: "@/x.webgui",     icon: "window maximize outline" },
    { id: "service", label: "project-store",        sublabel: "@/project-store.webservice",        namespace: "@/x.webservice", icon: "cog" },
    { id: "kit",     label: "i-components",         sublabel: "@/i-components.uilib",              namespace: "@/x.uilib",      icon: "cubes" },
    { id: "area",    label: "instance-manager",     sublabel: "@/instance-manager.uilib",          namespace: "@/x.uilib",      icon: "cubes" },
    { id: "lib",     label: "web-interface-builder", sublabel: "@/web-interface-builder.lib",      namespace: "@/x.lib",        icon: "book" },
    { id: "cli",     label: "maintenance-toolkit",  sublabel: "@/maintenance-toolkit.cli",         namespace: "@/x.cli",        icon: "terminal" },
    { id: "loader",  label: "webgui-library",       sublabel: "@/webgui-library.taskLoader",       namespace: "@/x.taskloader", icon: "sitemap" }
]

const DIAGRAM_EDGES = [
    { source: "app", target: "gui",     kind: "child" as const },
    { source: "app", target: "service", kind: "child" as const },
    { source: "gui", target: "kit",     kind: "dependency" as const },
    { source: "gui", target: "area",    kind: "dependency" as const },
    { source: "area", target: "kit",    kind: "dependency" as const },
    { source: "gui", target: "lib",     kind: "dependency" as const },
    { source: "kit", target: "loader",  kind: "dependency" as const },
    { source: "cli", target: "kit",     kind: "highlight" as const }
]

const DiagramStory = ({ direction, legend, minimap, controls }: any) => {
    const [ selected, setSelected ] = useState<string | undefined>(undefined)
    return <div className="mp-stack">
        <DiagramCanvas
            nodes={DIAGRAM_NODES}
            edges={DIAGRAM_EDGES}
            direction={direction}
            legend={legend}
            minimap={minimap}
            controls={controls}
            selectedId={selected}
            onSelectNode={(id) => setSelected(id === selected ? undefined : id)}
            height={430}/>
        <div className="mp-field__hint">
            { selected
                ? `Nó selecionado: ${selected} — clique de novo para soltar.`
                : "Clique num nó para fixar o realce; passar o mouse já esmaece quem não é vizinho." }
        </div>
    </div>
}

/* ------------------------------------------------------------------ */
/* MarkdownView                                                       */
/* ------------------------------------------------------------------ */

// O texto de demonstração TEM de conter HTML hostil: o valor do componente não
// é renderizar markdown (qualquer regex faz), é renderizar markdown que veio de
// um agente de IA ou de um campo de formulário sem virar XSS.
const MARKDOWN_SAMPLE = [
    "# Relatório de entrega",
    "",
    "O item **APPUI-123** publica o `DiagramCanvas` no kit. Ver o [guia de estilo](https://example.invalid/guia).",
    "",
    "> Cor de diagrama que não sai de token é cor que ignora o tema.",
    "",
    "| Componente | Origem | Linhas |",
    "| --- | --- | --- |",
    "| DiagramCanvas | control panel + package developer | 3 cópias |",
    "| MarkdownView | meta project manager | 2 cópias |",
    "",
    "- [x] paleta lida dos tokens",
    "- [x] legenda só com o que aparece",
    "- [ ] migrar os aplicativos (outra fase)",
    "",
    "```ts",
    "const palette = useDiagramPalette()",
    "```",
    "",
    "<u>Sublinhado</u> passa, porque é HTML de texto. O que vem abaixo, não:",
    "",
    "<script>window.__invadido = true</script>",
    "<img src=x onerror=\"window.__invadido = true\">",
    "<a href=\"javascript:alert(1)\">link com esquema perigoso</a>"
].join("\n")

const MarkdownStory = ({ source }: any) => {
    const text = source || MARKDOWN_SAMPLE
    const html = RenderMarkdown(text)
    const cut = [
        [ "<script>", html.indexOf("<script") < 0 ],
        [ "onerror=", html.indexOf("onerror") < 0 ],
        [ "javascript:", html.indexOf("javascript:") < 0 ]
    ]

    return <div className="mp-stack">
        <div style={{
            padding: 12,
            background: "var(--mp-surface)",
            border: "var(--mp-border)",
            boxShadow: "var(--mp-shadow-1)"
        }}>
            <MarkdownView text={text}/>
        </div>
        <div className="mp-kv__label">O que o DOMPurify cortou</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            { cut.map(([ label, gone ]: any) =>
                <span key={label} style={{
                    padding: "2px 8px",
                    border: "1px solid var(--mp-line)",
                    background: gone ? "var(--mp-success-tint)" : "var(--mp-danger-tint)",
                    color: gone ? "var(--mp-success)" : "var(--mp-danger)",
                    font: "700 11px/1.6 var(--mp-font-mono)"
                }}>
                    {label} {gone ? "removido" : "AINDA PRESENTE"}
                </span>) }
        </div>
    </div>
}

/* ------------------------------------------------------------------ */
/* MarkdownEditor                                                     */
/* ------------------------------------------------------------------ */

const EDITOR_SAMPLE = [
    "## Descrição do item",
    "",
    "Escreva aqui. A barra aplica **negrito**, *itálico*, <u>sublinhado</u>, listas e tabela.",
    "",
    "- selecione um trecho e clique num botão",
    "- ou use Ctrl+B / Ctrl+I / Ctrl+U",
    "- cole uma imagem: ela entra como data-URI no próprio markdown"
].join("\n")

const MarkdownEditorStory = ({ defaultMode }: any) => {
    const [ text, setText ] = useState(EDITOR_SAMPLE)
    return <MarkdownEditor
        value={text}
        onChange={setText}
        defaultMode={defaultMode}
        label="descrição de demonstração"
        height={400}/>
}

/* ------------------------------------------------------------------ */
/* CodeEditor                                                         */
/* ------------------------------------------------------------------ */

const CODE_SAMPLE = [
    "// Paleta do diagrama lida dos tokens --mp-* (nada de hexadecimal solto).",
    "import { useDiagramPalette } from \"@i-components\"",
    "",
    "const LIMIT = 128",
    "",
    "export const BuildNodes = (packages, direction = \"TB\") => {",
    "    const diagram = useDiagramPalette()",
    "    if(!packages || packages.length === 0) return null",
    "",
    "    return packages.map((item) => ({",
    "        id       : item.namespace,",
    "        label    : item.name,",
    "        kind     : diagram.kindOf(item.namespace),",
    "        selected : false,",
    "        weight   : item.size / LIMIT",
    "    }))",
    "}"
].join("\n")

const CodeEditorStory = ({ language, surface, minimap }: any) => {
    const [ code, setCode ] = useState(CODE_SAMPLE)
    return <div className="mp-stack">
        <CodeEditor
            value={code}
            onChange={setCode}
            language={language}
            surface={surface}
            minimap={minimap}
            height={400}/>
        <div className="mp-field__hint">
            GuessLanguage("boot.json") = <code>{GuessLanguage("boot.json")}</code> ·
            GuessLanguage("Component.tsx") = <code>{GuessLanguage("Component.tsx")}</code>
        </div>
    </div>
}

/* ------------------------------------------------------------------ */

export const advancedAuthoringStories: ComponentStory[] = [

    Story({
        id: "advanced.diagramcanvas",
        title: "DiagramCanvas",
        group: "Pesados — autoria",
        description: "Grafo com layout automático (dagre), legenda do que está na tela e realce de vizinhança. Toda a pintura sai de useDiagramPalette(): trocar o tema repinta o diagrama.",
        component: DiagramStory,
        props: { direction: "TB", legend: true, minimap: false, controls: true },
        controls: {
            direction: { label: "Direção do layout", type: "select", options: [ "TB", "LR" ] },
            legend:    { label: "Legenda", type: "boolean" },
            minimap:   { label: "Minimapa", type: "boolean" },
            controls:  { label: "Controles de zoom", type: "boolean" }
        },
        exportName: "DiagramCanvas",
        tags: [ "reactflow", "dagre", "tokens" ],
        usage: [
            "<DiagramCanvas",
            "    nodes={packages.map((p) => ({ id: p.namespace, label: p.name, namespace: p.namespace }))}",
            "    edges={links.map((l) => ({ source: l.from, target: l.to, kind: \"dependency\" }))}",
            "    direction=\"TB\"",
            "    selectedId={selected}",
            "    onSelectNode={(id, payload) => setSelected(id)}",
            "    minimap",
            "    height={520}/>"
        ].join("\n"),
        propsDoc: [
            { name: "nodes", type: "DiagramNodeInput[]", required: true, description: "id, label, sublabel, kind ou namespace, icon, payload." },
            { name: "edges", type: "DiagramEdgeInput[]", default: "[]", description: "source, target e kind: child | dependency | highlight." },
            { name: "direction", type: "\"TB\" | \"LR\"", default: "\"TB\"", description: "Direção do dagre. Com onDirectionChange vira controlada." },
            { name: "selectedId", type: "string", description: "Nó em foco: destaca-o e esmaece quem não é vizinho." },
            { name: "onSelectNode", type: "(id, payload) => void", description: "Clique no nó. O payload volta intacto — é como o app religa o nó ao domínio." },
            { name: "legend", type: "boolean", default: "true", description: "Legenda montada só com os tipos e relações presentes." },
            { name: "minimap", type: "boolean", default: "false" },
            { name: "controls", type: "boolean", default: "true", description: "Controles de zoom/enquadramento do reactflow." },
            { name: "nodeSize", type: "{ width, height }", default: "220 × 80", description: "Tamanho padrão do nó (alimenta o layout)." },
            { name: "relationLabels", type: "Record<DiagramEdgeKind, string>", description: "Texto de cada relação na legenda." },
            { name: "height", type: "number | string", default: "460" }
        ],
        notes: "Substitui três implementações à mão (dois diagramas do Ecosystem Control Panel e o diagrama de runtime do Package Developer). As três traziam tabela de cor em hexadecimal e, por isso, eram a única superfície da plataforma que não seguia o tema."
    }),

    Story({
        id: "advanced.markdownview",
        title: "MarkdownView",
        group: "Pesados — autoria",
        description: "Markdown renderizado com marked e sanitizado com DOMPurify. A amostra inclui HTML hostil de propósito: os selos abaixo mostram o que foi cortado.",
        component: MarkdownStory,
        props: { source: "" },
        controls: {
            source: { label: "Markdown (vazio = amostra)", type: "text" }
        },
        exportName: "MarkdownView",
        tags: [ "marked", "dompurify", "xss" ],
        usage: [
            "<MarkdownView text={item.description}/>",
            "",
            "// quem precisa do HTML (exportar, pós-processar) parte daqui —",
            "// chamar marked direto é justamente o caminho sem sanitização.",
            "const html = RenderMarkdown(item.description, { allowAttributes: [\"data-item-ref\"] })"
        ].join("\n"),
        propsDoc: [
            { name: "text", type: "string", description: "Markdown de origem (alternativa: passar como filho)." },
            { name: "children", type: "string", description: "Mesma coisa que text, na forma <MarkdownView>{md}</MarkdownView>." },
            { name: "allowAttributes", type: "string[]", description: "Atributos que o DOMPurify deve preservar (ex.: a marca de referência de item do MPM)." },
            { name: "allowTags", type: "string[]", description: "Tags extras preservadas." },
            { name: "transformHtml", type: "(html) => string", description: "Transformação aplicada DEPOIS da sanitização (linkificar chaves, por exemplo)." },
            { name: "onClick", type: "(event) => void", description: "Clique delegado: um handler cobre todos os links do texto." },
            { name: "empty", type: "ReactNode", default: "—", description: "O que mostrar quando não há texto." }
        ],
        notes: "Descrição de item pode conter imagem em data-URI e texto escrito por agente. RenderMarkdown sanitiza sempre — não existe caminho de renderização sem DOMPurify."
    }),

    Story({
        id: "advanced.markdowneditor",
        title: "MarkdownEditor",
        group: "Pesados — autoria",
        description: "Editor de markdown do kit: textarea + barra de ferramentas + preview pelo MarkdownView, em três modos. Imagem colada ou arrastada entra como data-URI no próprio texto.",
        component: MarkdownEditorStory,
        props: { defaultMode: "split" },
        controls: {
            defaultMode: { label: "Modo inicial", type: "select", options: [ "edit", "split", "preview" ] }
        },
        exportName: "MarkdownEditor",
        tags: [ "autoria", "sem dependência de editor" ],
        usage: [
            "<MarkdownEditor",
            "    value={draft}",
            "    onChange={setDraft}",
            "    onBlur={() => save(draft)}",
            "    label=\"descrição do item\"",
            "    actions={<Button variant=\"primary\" onClick={done}>Concluir</Button>}",
            "    height={420}/>"
        ].join("\n"),
        propsDoc: [
            { name: "value", type: "string", required: true, description: "Markdown. O componente é controlado." },
            { name: "onChange", type: "(markdown) => void", required: true },
            { name: "mode", type: "\"edit\" | \"split\" | \"preview\"", description: "Modo controlado; com defaultMode o editor guarda o modo sozinho." },
            { name: "defaultMode", type: "MarkdownEditorMode", default: "\"edit\"" },
            { name: "label", type: "string", description: "O que está sendo editado." },
            { name: "actions", type: "ReactNode", description: "Ações à direita da barra. O editor não decide quando salvar." },
            { name: "maxImageBytes", type: "number", default: "5 MB", description: "Acima do limite a imagem é recusada, com aviso." },
            { name: "onImageError", type: "(mensagem) => void" },
            { name: "toolbar", type: "boolean", default: "true" },
            { name: "readOnly", type: "boolean", default: "false" },
            { name: "height", type: "number | string", default: "380" }
        ],
        notes: "O kit NÃO adota @uiw/react-md-editor (a dependência do MPM): um editor de terceiro traz a folha de estilo dele junto e devolveria para dentro do kit a matriz de estilo paralela que o projeto passou três fases removendo."
    }),

    Story({
        id: "advanced.codeeditor",
        title: "CodeEditor",
        group: "Pesados — autoria",
        description: "Editor de código sem dependência: <pre> colorido atrás de um <textarea> transparente, com gutter, banda da linha ativa e minimapa. O realce sai dos tokens — troque o tema e as cores mudam.",
        component: CodeEditorStory,
        props: { language: "typescript", surface: "paper", minimap: true },
        controls: {
            language: { label: "Linguagem", type: "select", options: [ "typescript", "javascript", "json", "css", "xml", "shell", "plaintext" ] },
            surface:  { label: "Superfície", type: "select", options: [ "paper", "terminal" ] },
            minimap:  { label: "Minimapa", type: "boolean" }
        },
        exportName: "CodeEditor",
        tags: [ "editor", "tokens", "sem dependência" ],
        usage: [
            "<CodeEditor",
            "    value={content}",
            "    onChange={setContent}",
            "    language={GuessLanguage(filename)}",
            "    surface=\"paper\"",
            "    scrollTo={{ line: error.line, n: requestId }}",
            "    height={520}/>"
        ].join("\n"),
        propsDoc: [
            { name: "value", type: "string", required: true },
            { name: "onChange", type: "(value) => void", description: "Sem onChange o editor fica somente-leitura." },
            { name: "language", type: "string", default: "\"plaintext\"", description: "javascript | typescript | json | css | xml | shell. Use GuessLanguage(filename)." },
            { name: "surface", type: "\"paper\" | \"terminal\"", default: "\"paper\"", description: "paper acompanha a página; terminal usa a família --mp-terminal-*." },
            { name: "scrollTo", type: "{ line, n }", description: "Rola até a linha; n muda a cada pedido, para reagir ao mesmo número duas vezes." },
            { name: "gutter", type: "boolean", default: "true" },
            { name: "minimap", type: "boolean", default: "true" },
            { name: "readOnly", type: "boolean", default: "false" },
            { name: "height", type: "number | string", default: "420" }
        ],
        notes: "Derivado do editor do Package Developer, que já era livre de dependência mas tinha as cores do VS Code literais no arquivo (#6a9955, #ce9178, #569cd6). Aqui cada token do realce é uma variável CSS derivada de --mp-*; o minimapa, que é canvas, lê a mesma paleta por useTokenPalette()."
    })
]
