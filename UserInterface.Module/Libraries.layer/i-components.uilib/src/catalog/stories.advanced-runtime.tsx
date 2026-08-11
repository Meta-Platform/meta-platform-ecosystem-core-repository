import * as React from "react"
import { useEffect, useRef, useState } from "react"

import type { ComponentStory } from "./types"
import Terminal from "../components/advanced/Terminal"
import type { TerminalHandle } from "../components/advanced/Terminal"
import TimeSeriesChart from "../components/advanced/TimeSeriesChart"
import type { TimeSeriesPoint } from "../components/advanced/TimeSeriesChart"
import LogViewer from "../components/advanced/LogViewer"
import type { LogEntry } from "../components/advanced/LogViewer"
import { Button } from "../components/Controls"

// Histórias dos componentes pesados de runtime (Terminal, TimeSeriesChart,
// LogViewer). Agregadas por `stories.tsx` na coleção do kit.
//
// Os três mostram um processo VIVO — um terminal parado, um gráfico sem
// amostra e um log que não rola não provam nada. Por isso cada preview tem o
// seu gerador: o terminal digita, o gráfico amostra e o log escreve.

const SOURCE = "@/i-components.uilib"

// Os três moram na mesma família do catálogo ("Pesados — Runtime"), então o grupo é
// padrão do ajudante em vez de repetido em cada história.
const Story = (story:Omit<ComponentStory, "sourcePackage" | "group"> & { group?:string }):ComponentStory => ({
    sourcePackage : SOURCE,
    importFrom    : "@i-components",
    status        : "stable",
    group         : "Pesados — Runtime",
    ...story
})

/* ------------------------------------------------------------------ */
/* Terminal                                                           */
/* ------------------------------------------------------------------ */

const ESC = "\u001B["

// Saída fabricada, com as sequências ANSI de verdade: é assim que se vê se a
// paleta do tema chegou ao canvas do xterm.
const SCRIPT = [
    `${ESC}1;34m❯${ESC}0m executor package ui-catalog.desktopapp`,
    `${ESC}2m[19:04:11]${ESC}0m ${ESC}36m[executor]${ESC}0m resolvendo hierarquia de metadados`,
    `${ESC}2m[19:04:11]${ESC}0m ${ESC}36m[executor]${ESC}0m 4 pacotes na árvore`,
    `${ESC}2m[19:04:12]${ESC}0m ${ESC}35m[web-interface]${ESC}0m montando front-end (perfil release)`,
    `${ESC}2m[19:04:19]${ESC}0m ${ESC}33maviso${ESC}0m  bundle com 2.4 MB — acima do orçamento`,
    `${ESC}2m[19:04:20]${ESC}0m ${ESC}32m✔${ESC}0m front-end montado em 8.1s`,
    `${ESC}2m[19:04:20]${ESC}0m ${ESC}31merro${ESC}0m   porta 8085 ocupada, tentando 8086`,
    `${ESC}2m[19:04:21]${ESC}0m ${ESC}32m✔${ESC}0m instância ATIVA em http://localhost:8086`,
    `${ESC}1;34m❯${ESC}0m ${ESC}5m▏${ESC}0m`
]

const TerminalPreview = ({ fontSize = 13, readOnly = true }:any) => {

    const handleRef = useRef<TerminalHandle>()
    const [ run, setRun ] = useState(0)

    useEffect(() => {
        let line = 0
        const timer = window.setInterval(() => {
            if(!handleRef.current) return
            if(line >= SCRIPT.length){ window.clearInterval(timer); return }
            handleRef.current.WriteLine(SCRIPT[line])
            line++
        }, 420)
        // Sem isto, cada troca de controle deixa um temporizador escrevendo num
        // terminal já descartado.
        return () => window.clearInterval(timer)
    }, [run])

    return <div style={{ display: "grid", gap: 10 }}>
        <Terminal
            key={run}
            height={240}
            fontSize={Number(fontSize)}
            readOnly={readOnly}
            initialText={`${ESC}2mMeta Platform — terminal do kit${ESC}0m\r\n`}
            onReady={(handle:TerminalHandle) => { handleRef.current = handle }}/>
        <div>
            <Button size="sm" icon="redo" onClick={() => setRun(run + 1)}>Rodar de novo</Button>
        </div>
    </div>
}

/* ------------------------------------------------------------------ */
/* TimeSeriesChart                                                    */
/* ------------------------------------------------------------------ */

const WINDOW_MS = 90000
const SAMPLE_MS = 1000

const NextValue = (current:number, floor:number, ceiling:number):number => {
    const next = current + (Math.random() - 0.48) * (ceiling - floor) * 0.12
    return Math.max(floor, Math.min(ceiling, next))
}

const ChartPreview = ({ height = 180, showBand = true, showLegend = true }:any) => {

    const [ cpu, setCpu ] = useState<TimeSeriesPoint[]>([])
    const [ system, setSystem ] = useState<TimeSeriesPoint[]>([])

    useEffect(() => {
        // Meia janela de histórico já na abertura: um gráfico que começa vazio
        // não mostra que ele é uma janela ROLANTE.
        const now = Date.now()
        const seed = (floor:number, ceiling:number) => {
            const points:TimeSeriesPoint[] = []
            let value = (floor + ceiling) / 2
            for(let index = 45; index >= 0; index--){
                value = NextValue(value, floor, ceiling)
                points.push({ x: now - index * SAMPLE_MS, y: Math.round(value * 10) / 10 })
            }
            return points
        }
        setCpu(seed(4, 92))
        setSystem(seed(2, 40))

        const timer = window.setInterval(() => {
            const stamp = Date.now()
            // Um buraco de vez em quando: a linha ABRE ali, e é isso que
            // distingue "medição falhou" de "valor caiu a zero".
            const gap = Math.random() < 0.05
            setCpu((points) => points
                .concat([ { x: stamp, y: gap ? null : Math.round(NextValue(points.length ? (points[points.length - 1].y as number) || 40 : 40, 4, 92) * 10) / 10 } ])
                .slice(-120))
            setSystem((points) => points
                .concat([ { x: stamp, y: Math.round(NextValue(points.length ? (points[points.length - 1].y as number) || 12 : 12, 2, 40) * 10) / 10 } ])
                .slice(-120))
        }, SAMPLE_MS)

        return () => window.clearInterval(timer)
    }, [])

    return <TimeSeriesChart
        height={Number(height)}
        windowMs={WINDOW_MS}
        yMax={100}
        showLegend={showLegend}
        formatValue={(value:number) => `${value.toFixed(0)}%`}
        bands={showBand ? [ { from: 80, to: 100, tone: "danger", label: "saturação (≥80%)" } ] : []}
        series={[
            { key: "cpu", label: "CPU do processo", points: cpu, area: true },
            { key: "system", label: "CPU do sistema", points: system, dashed: true, area: false }
        ]}/>
}

/* ------------------------------------------------------------------ */
/* LogViewer                                                          */
/* ------------------------------------------------------------------ */

const SOURCES = [ "executor", "web-interface", "http-server", "daemon" ]

const MESSAGES:{ level:string, message:string }[] = [
    { level: "info",    message: "hierarquia de metadados resolvida" },
    { level: "debug",   message: `cache de build ${ESC}2m(fingerprint por conteúdo)${ESC}0m conferido` },
    { level: "message", message: `front-end montado ${ESC}32m✔${ESC}0m` },
    { level: "info",    message: "instância registrada no supervisor" },
    { level: "warn",    message: "bundle acima do orçamento (2.4 MB)" },
    { level: "error",   message: `porta 8085 ocupada — ${ESC}31mEADDRINUSE${ESC}0m` },
    { level: "trace",   message: "GET /ui-catalog/bundle.js 200" },
    { level: "fatal",   message: "não foi possível abrir o socket de controle" }
]

const BuildEntry = (index:number):LogEntry => {
    const template = MESSAGES[index % MESSAGES.length]
    return {
        id      : index,
        ts      : new Date(Date.now() - (400 - index) * 900).toISOString().slice(11, 23),
        level   : template.level,
        source  : SOURCES[index % SOURCES.length],
        message : `${template.message} #${index}`,
        data    : template.level === "error" ? { port: 8085, retry: true } : undefined
    }
}

const LogPreview = ({ height = 340, ansi = "render", showLineNumbers = true }:any) => {

    // Começa com 400 linhas de propósito: acima de 200 a virtualização liga, e
    // é ela que se quer ver funcionando.
    const [ entries, setEntries ] = useState<LogEntry[]>(
        () => Array.from({ length: 400 }, (_, index) => BuildEntry(index)))

    useEffect(() => {
        let next = 400
        const timer = window.setInterval(() => {
            setEntries((current) => current.concat([ BuildEntry(next++) ]))
        }, 900)
        return () => window.clearInterval(timer)
    }, [])

    return <LogViewer
        entries={entries}
        height={Number(height)}
        ansi={ansi}
        showLineNumbers={showLineNumbers}
        meta={<span style={{ color: "var(--mp-terminal-green)" }}>ao vivo</span>}/>
}

/* ------------------------------------------------------------------ */

export const advancedRuntimeStories:ComponentStory[] = [
    Story({
        id: "runtime.terminal",
        title: "Terminal",
        description: "Emulador de terminal (xterm.js) com a paleta do design system. Recebe bytes crus — as sequências de escape são o conteúdo, e é o xterm que as interpreta.",
        component: TerminalPreview,
        props: { fontSize: 13, readOnly: true },
        controls: {
            fontSize: { label: "Tamanho da fonte", type: "number", min: 9, max: 22 },
            readOnly: { label: "Somente leitura", type: "boolean" }
        },
        exportName: "Terminal",
        tags: [ "xterm", "processo" ],
        usage: [
            "import { Terminal } from \"@i-components\"",
            "import type { TerminalHandle } from \"@i-components\"",
            "",
            "const handle = useRef<TerminalHandle>()",
            "",
            "<Terminal",
            "    height={420}",
            "    onReady={(api) => { handle.current = api }}",
            "    onData={(data) => socket.send(JSON.stringify({ type: \"input\", data }))}",
            "    onResize={({ cols, rows }) => socket.send(JSON.stringify({ type: \"resize\", cols, rows }))}/>",
            "",
            "// saída do processo:",
            "handle.current?.Write(message.data)"
        ].join("\n"),
        propsDoc: [
            { name: "onData", type: "(data:string) => void", description: "Tudo que o usuário digita, já em bytes de terminal. Mande para o processo do outro lado." },
            { name: "onResize", type: "(size:{cols,rows}) => void", description: "Novo tamanho em células depois do fit. Sem avisar o processo, ele continua desenhando para 80x24." },
            { name: "onReady", type: "(handle:TerminalHandle) => void", description: "Entrega a API imperativa: Write, WriteLine, Clear, Reset, Focus, Fit, ScrollToBottom, Size." },
            { name: "onTitleChange", type: "(title:string) => void", description: "Sequência OSC 0/2 emitida pelo programa." },
            { name: "initialText", type: "string", description: "Escrito uma única vez, logo depois de abrir." },
            { name: "fontSize", type: "number", default: "13" },
            { name: "scrollback", type: "number", default: "5000", description: "Linhas mantidas acima do topo." },
            { name: "cursorBlink", type: "boolean", default: "true" },
            { name: "readOnly", type: "boolean", default: "false", description: "Não envia teclado e esconde o cursor — para saída de log/build." },
            { name: "convertEol", type: "boolean", default: "true", description: "Traduz \\n solto em \\r\\n." },
            { name: "height", type: "number | string", default: "\"100%\"" },
            { name: "ref", type: "Ref<TerminalHandle>", description: "Mesma API do onReady, para quem prefere ref." }
        ],
        notes: "A cor não vem de CSS: o xterm pinta em canvas e recebe a paleta por opção. O componente monta o tema com os tokens --mp-terminal-* e troca `options.theme` quando o data-theme do documento muda — sem recriar o terminal, que apagaria o histórico da tela."
    }),
    Story({
        id: "runtime.timeserieschart",
        title: "TimeSeriesChart",
        description: "Série temporal rolante desenhada com d3: escala de tempo, eixos com ticks legíveis, faixa de alerta e cursor de leitura. Um eixo Y só — unidades diferentes vão em gráficos separados.",
        component: ChartPreview,
        props: { height: 180, showBand: true, showLegend: true },
        controls: {
            height: { label: "Altura", type: "number", min: 90, max: 400 },
            showBand: { label: "Faixa de alerta", type: "boolean" },
            showLegend: { label: "Legenda", type: "boolean" }
        },
        exportName: "TimeSeriesChart",
        tags: [ "d3", "métricas" ],
        usage: [
            "import { TimeSeriesChart } from \"@i-components\"",
            "",
            "<TimeSeriesChart",
            "    height={180}",
            "    windowMs={90000}",
            "    yMax={100}",
            "    formatValue={(value) => `${value.toFixed(0)}%`}",
            "    bands={[ { from: 80, to: 100, tone: \"danger\", label: \"saturação\" } ]}",
            "    series={[",
            "        { key: \"cpu\", label: \"CPU do processo\", points: cpu, area: true }",
            "    ]}/>"
        ].join("\n"),
        propsDoc: [
            { name: "series", type: "TimeSeries[]", required: true, description: "{ key, label, points, color?, area?, dashed? }. Sem `color`, o acento do tema entra pela ordem." },
            { name: "series[].points", type: "{ x:number, y?:number|null }[]", required: true, description: "x em milissegundos. y ausente/null ABRE a linha — medição que falhou não é interpolada." },
            { name: "height", type: "number", default: "160" },
            { name: "yMin", type: "number", default: "0" },
            { name: "yMax", type: "number", description: "Teto fixo. Ausente = maior valor com 15% de folga." },
            { name: "windowMs", type: "number", description: "Janela rolante à direita: o domínio é [último instante - windowMs, último instante]." },
            { name: "from / to", type: "number", description: "Domínio de tempo explícito; vence sobre windowMs." },
            { name: "formatValue", type: "(value:number) => string", description: "Formata o eixo Y e o cursor. A margem esquerda se ajusta ao maior rótulo." },
            { name: "formatTime", type: "(time:number) => string", default: "HH:MM:SS" },
            { name: "bands", type: "ChartBand[]", description: "{ from, to?, tone?, label? } — faixa de alerta em unidades do eixo Y." },
            { name: "showLegend / showGrid / showAxis", type: "boolean", default: "true" },
            { name: "onHover", type: "(hover?:TimeSeriesHover) => void", description: "Amostra sob o cursor — serve para sincronizar dois gráficos." },
            { name: "emptyLabel", type: "string", default: "\"sem amostras ainda\"" }
        ],
        notes: "O React desenha o que é dado (áreas, linhas, faixas, marcadores) e o d3 desenha só os eixos, dentro de dois <g> que ele limpa e repinta. Nenhum dos dois escreve no nó do outro — é o que evita o conflito clássico entre a reconciliação do React e a seleção do d3."
    }),
    Story({
        id: "runtime.logviewer",
        title: "LogViewer",
        description: "Visor de log com virtualização, autoscroll travável, filtro por texto e por nível, e cor ANSI traduzida para os tokens do tema. Aceita log estruturado (entries) e texto cru (lines).",
        component: LogPreview,
        props: { height: 340, ansi: "render", showLineNumbers: true },
        controls: {
            height: { label: "Altura", type: "number", min: 160, max: 600 },
            ansi: { label: "ANSI", type: "select", options: [ "render", "strip", "raw" ] },
            showLineNumbers: { label: "Numerar linhas", type: "boolean" }
        },
        exportName: "LogViewer",
        tags: [ "log", "ansi", "virtualizado" ],
        usage: [
            "import { LogViewer } from \"@i-components\"",
            "",
            "// log estruturado (JSONL da plataforma)",
            "<LogViewer entries={records} height={420} maxLines={4000}/>",
            "",
            "// log de texto cru, vindo do stdout de um processo",
            "<LogViewer lines={lines} ansi=\"render\" meta={connected ? \"ao vivo\" : \"desconectado\"}/>"
        ].join("\n"),
        propsDoc: [
            { name: "entries", type: "LogEntry[]", description: "{ id?, ts?, level?, source?, message, data?, raw? }." },
            { name: "lines", type: "string[]", description: "Atalho para texto cru: cada string vira uma entrada. O nível é adivinhado da linha." },
            { name: "height", type: "number | string", default: "360" },
            { name: "maxLines", type: "number", default: "4000", description: "Teto em memória; o corte é pela frente, que é o lado velho." },
            { name: "ansi", type: "\"render\" | \"strip\" | \"raw\"", default: "\"render\"", description: "render pinta a cor do stream com os tokens --mp-terminal-*; strip apaga as sequências." },
            { name: "levels", type: "string[]", default: "LOG_LEVELS", description: "Níveis oferecidos nos chips de filtro." },
            { name: "defaultLevels", type: "string[]", default: "[]", description: "Nenhum chip ligado = todos os níveis." },
            { name: "defaultFollow", type: "boolean", default: "true", description: "Autoscroll. Rolar para cima desliga sozinho." },
            { name: "defaultWrap", type: "boolean", default: "false", description: "Quebrar linha desliga a virtualização (altura deixa de ser fixa)." },
            { name: "rowHeight", type: "number", default: "18", description: "Altura da linha — é o que torna a virtualização possível." },
            { name: "showToolbar / showLineNumbers / showLevelFilter", type: "boolean", default: "true" },
            { name: "toolbarExtra / meta", type: "ReactNode", description: "Estado da conexão, tamanho do arquivo, seletor de arquivo do dia — o kit não sabe de onde o log vem." },
            { name: "onClear", type: "() => void", description: "Sem ele, limpar só esconde o que já passou; com ele, quem é dono do buffer decide." },
            { name: "onFilterChange / onLevelsChange / onFollowChange", type: "(value) => void" }
        ],
        notes: "Acima de 200 linhas visíveis só as que cabem na tela existem no DOM. Foi por isso que ele nasceu: quatro mil <div> de log travavam a rolagem do painel, justamente durante a investigação de uma falha."
    })
]
