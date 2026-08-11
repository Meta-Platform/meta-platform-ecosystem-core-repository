import * as React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import {
    area as BuildArea,
    axisBottom,
    axisLeft,
    bisector,
    line as BuildLine,
    scaleLinear,
    scaleTime,
    select,
    timeFormat
} from "d3"

import { useTokenPalette } from "../../theme/palette"
import type { TokenPalette } from "../../theme/palette"

// Série temporal do kit — a linha do tempo de uma métrica viva.
//
// De onde veio: o gráfico de desempenho do Instance Executor Control Panel
// (`Components/system/TimeSeriesChart.tsx`), que desenhava CPU e memória lidos
// de /proc. Aquele traçava o caminho SVG à mão, com escala linear escrita na
// unha, e recebia a cor pronta em cada série — ou seja, quem chamava é que
// tinha de conhecer a paleta.
//
// O que mudou aqui:
//   - as escalas, os geradores de caminho e os eixos são do d3 (é para isso que
//     a biblioteca existe: `nice()` e ticks legíveis não se improvisam);
//   - a cor é opcional e, quando ausente, sai dos acentos do design system;
//   - o domínio de tempo é declarável (`from`/`to` ou `windowMs`), o que
//     permite uma janela rolante de tamanho fixo mesmo com amostragem irregular;
//   - existe faixa de alerta (`bands`), que era o pedido recorrente de quem
//     olha métrica: "acima de 80% é problema" tem de aparecer no desenho.
//
// Continua com UM eixo Y só, de propósito: duas escalas no mesmo gráfico fazem
// o leitor comparar alturas que não são comparáveis. Unidades diferentes vão em
// gráficos separados.
//
// Divisão de trabalho com o React: o React desenha o que é dado (áreas, linhas,
// faixas, marcadores); o d3 desenha só os EIXOS, dentro de dois <g> próprios,
// que ele limpa e repinta. Nenhum dos dois escreve no nó do outro.

export type TimeSeriesPoint = {
    // Instante em milissegundos (Date.now()).
    x : number
    // Ausente/null = medição falhou naquele instante. A linha ABRE ali em vez
    // de interpolar: uma reta por cima esconderia que não houve amostra.
    y?: number | null
}

export type TimeSeries = {
    key    : string
    label  : string
    points : TimeSeriesPoint[]
    // Sem cor, o componente distribui os acentos do tema na ordem das séries.
    color? : string
    // Preenche a área sob a linha.
    area?  : boolean
    dashed?: boolean
}

export type ChartBandTone = "success" | "warning" | "danger" | "info" | "neutral"

// Faixa horizontal em unidades do eixo Y — "acima de 80% é alerta".
export type ChartBand = {
    from   : number
    to?    : number
    tone?  : ChartBandTone
    label? : string
}

export type TimeSeriesHover = {
    index  : number
    x      : number
    values : Record<string, number | undefined>
}

export type TimeSeriesChartProps = {
    series       : TimeSeries[]
    height?      : number
    yMin?        : number
    // Teto fixo do eixo (percentual, por exemplo). Ausente = calculado com
    // folga sobre o maior valor.
    yMax?        : number
    // Janela de tempo à direita, em milissegundos. Com ela o gráfico rola:
    // o domínio é sempre [último instante - windowMs, último instante].
    windowMs?    : number
    // Domínio explícito de tempo; vence sobre `windowMs`.
    from?        : number
    to?          : number
    formatValue? : (value:number) => string
    formatTime?  : (time:number) => string
    bands?       : ChartBand[]
    showLegend?  : boolean
    showGrid?    : boolean
    showAxis?    : boolean
    emptyLabel?  : string
    className?   : string
    // Avisa qual amostra está sob o cursor (para sincronizar dois gráficos, por
    // exemplo). `undefined` quando o cursor sai.
    onHover?     : (hover:TimeSeriesHover | undefined) => void
}

const MARGIN = { top: 10, right: 12, bottom: 22, left: 12 }

const DefaultSeriesColors = (palette:TokenPalette):string[] => [
    palette.accents.blue,
    palette.accents.orange,
    palette.accents.violet,
    palette.accents.cyan,
    palette.accents.pink,
    palette.states.success
]

const HAS_VALUE = (point:TimeSeriesPoint):boolean =>
    point && point.y !== undefined && point.y !== null && !Number.isNaN(point.y as number)

const FORMAT_CLOCK = timeFormat("%H:%M:%S")

const DefaultFormatValue = (value:number):string => {
    const magnitude = Math.abs(value)
    if(magnitude >= 100) return value.toFixed(0)
    if(magnitude >= 10)  return value.toFixed(1)
    return value.toFixed(2)
}

const TimeSeriesChart = ({
    series = [],
    height = 160,
    yMin   = 0,
    yMax,
    windowMs,
    from,
    to,
    formatValue = DefaultFormatValue,
    formatTime  = (time:number) => FORMAT_CLOCK(new Date(time)),
    bands       = [],
    showLegend  = true,
    showGrid    = true,
    showAxis    = true,
    emptyLabel  = "sem amostras ainda",
    className   = "",
    onHover
}:TimeSeriesChartProps) => {

    const wrapperRef = useRef<HTMLDivElement>(null)
    const xAxisRef   = useRef<SVGGElement>(null)
    const yAxisRef   = useRef<SVGGElement>(null)

    const [ width, setWidth ] = useState(640)
    const [ hover, setHover ] = useState<{ index:number, left:number } | undefined>()

    const palette = useTokenPalette()

    // A largura medida É o viewBox. Com só o listener de `resize` da janela o
    // gráfico nasce antes de o flex distribuir o espaço e o desenho vaza da
    // caixa até alguém redimensionar a janela.
    useEffect(() => {
        const element = wrapperRef.current
        if(!element) return

        const Measure = () => setWidth(element.clientWidth || 640)
        Measure()

        const ResizeObserverImpl = (window as any).ResizeObserver
        if(ResizeObserverImpl){
            const observer = new ResizeObserverImpl(Measure)
            observer.observe(element)
            return () => observer.disconnect()
        }

        window.addEventListener("resize", Measure)
        return () => window.removeEventListener("resize", Measure)
    }, [])

    const colors = useMemo(() => DefaultSeriesColors(palette), [palette])

    const painted = useMemo(() => series.map((item, index) => ({
        ...item,
        points : item.points || [],
        color  : item.color || colors[index % colors.length]
    })), [series, colors])

    const allPoints = useMemo(
        () => painted.reduce((all:TimeSeriesPoint[], item) => all.concat(item.points), []),
        [painted])

    const hasData = allPoints.some(HAS_VALUE)

    // A série mais longa é a régua do eixo X: é nela que o cursor procura o
    // índice sob o mouse.
    const reference = useMemo(
        () => painted.reduce(
            (longest, item) => item.points.length > longest.points.length ? item : longest,
            { points: [] as TimeSeriesPoint[] } as any),
        [painted])

    const domain = useMemo(() => {
        const xs = allPoints.map((point) => point.x)
        const ys = allPoints.filter(HAS_VALUE).map((point) => point.y as number)

        let xEnd   = to !== undefined ? to : (xs.length ? Math.max.apply(null, xs) : Date.now())
        let xStart = from !== undefined
            ? from
            : windowMs !== undefined
                ? xEnd - windowMs
                : (xs.length ? Math.min.apply(null, xs) : xEnd - 60000)
        if(xStart >= xEnd) xStart = xEnd - 1000

        // Piso de escala: sem ele, uma série inteira em ~0,2% desenharia picos
        // dramáticos de nada.
        const dataMax = ys.length ? Math.max.apply(null, ys) : 1
        const bandMax = bands.reduce((top, band) => Math.max(top, band.to !== undefined ? band.to : band.from), 0)
        const top = yMax !== undefined ? yMax : Math.max(dataMax * 1.15, bandMax, 1)

        return { xStart, xEnd, yBottom: yMin, yTop: top }
    }, [allPoints, from, to, windowMs, yMin, yMax, bands])

    // A margem esquerda tem de caber o MAIOR rótulo do eixo: com valor fixo,
    // "1.1 GB" e "17 KB/s" apareciam cortados pela metade.
    const marginLeft = useMemo(() => {
        if(!showAxis) return MARGIN.left
        const labels = [ 0, 0.25, 0.5, 0.75, 1 ]
            .map((ratio) => formatValue(domain.yBottom + (domain.yTop - domain.yBottom) * ratio))
        const longest = labels.reduce((size, label) => Math.max(size, label.length), 0)
        // ~6,2px por caractere na monoespaçada de 10px, mais o respiro do tick.
        return Math.max(MARGIN.left, Math.ceil(longest * 6.2) + 14)
    }, [showAxis, domain, formatValue])

    const plotWidth  = Math.max(1, width - marginLeft - MARGIN.right)
    const plotHeight = Math.max(1, height - MARGIN.top - MARGIN.bottom)

    const x = useMemo(
        () => scaleTime().domain([ new Date(domain.xStart), new Date(domain.xEnd) ]).range([ 0, plotWidth ]),
        [domain.xStart, domain.xEnd, plotWidth])

    const y = useMemo(
        () => scaleLinear().domain([ domain.yBottom, domain.yTop ]).range([ plotHeight, 0 ]),
        [domain.yBottom, domain.yTop, plotHeight])

    const BuildPathLine = useMemo(() => BuildLine<TimeSeriesPoint>()
        .defined(HAS_VALUE)
        .x((point) => x(new Date(point.x)))
        .y((point) => y(point.y as number)), [x, y])

    const BuildPathArea = useMemo(() => BuildArea<TimeSeriesPoint>()
        .defined(HAS_VALUE)
        .x((point) => x(new Date(point.x)))
        .y0(y(domain.yBottom))
        .y1((point) => y(point.y as number)), [x, y, domain.yBottom])

    const gridValues = useMemo(() => y.ticks(4), [y])

    // Os formatadores entram por ref para que o efeito dos eixos não dependa da
    // identidade de uma função anônima criada a cada render do pai.
    const formatValueRef = useRef(formatValue)
    const formatTimeRef  = useRef(formatTime)
    formatValueRef.current = formatValue
    formatTimeRef.current  = formatTime

    // Os eixos são o único pedaço desenhado pelo d3. Cada passada limpa o <g>
    // antes de repintar, e a limpeza do efeito o esvazia — senão os nós de tick
    // de um domínio antigo sobrevivem por baixo dos novos.
    useEffect(() => {
        if(!showAxis) return
        const xNode = xAxisRef.current
        const yNode = yAxisRef.current
        if(!xNode || !yNode) return

        const Paint = (node:SVGGElement) => {
            const selection = select(node)
            selection.selectAll("*").remove()
            return selection
        }

        Paint(xNode).call(axisBottom(x)
            .ticks(Math.max(2, Math.floor(plotWidth / 90)))
            .tickSizeOuter(0)
            .tickFormat((value:any) => formatTimeRef.current(value instanceof Date ? value.getTime() : Number(value))) as any)

        Paint(yNode).call(axisLeft(y)
            .tickValues(gridValues)
            .tickSizeOuter(0)
            .tickFormat((value:any) => formatValueRef.current(Number(value))) as any)

        const Style = (node:SVGGElement) => {
            const selection = select(node)
            selection.selectAll("path.domain").attr("stroke", palette.lineSoft)
            selection.selectAll("line").attr("stroke", palette.lineSoft)
            selection.selectAll("text")
                .attr("fill", palette.muted)
                .attr("font-family", palette.fontMono)
                .attr("font-size", 10)
        }
        Style(xNode)
        Style(yNode)

        return () => {
            select(xNode).selectAll("*").remove()
            select(yNode).selectAll("*").remove()
        }
    }, [showAxis, x, y, gridValues, plotWidth, palette])

    const bisectX = useMemo(() => bisector((point:TimeSeriesPoint) => point.x).center, [])

    const OnMove = (event:React.MouseEvent) => {
        const points:TimeSeriesPoint[] = reference.points
        if(!points.length) return

        const bounds  = (event.currentTarget as HTMLElement).getBoundingClientRect()
        const offsetX = event.clientX - bounds.left
        const time    = x.invert(Math.max(0, Math.min(plotWidth, offsetX - marginLeft))).getTime()
        const index   = Math.max(0, Math.min(points.length - 1, bisectX(points, time)))

        setHover({ index, left: offsetX })
        if(onHover) onHover({
            index,
            x      : points[index].x,
            values : painted.reduce((values:Record<string, number | undefined>, item) => {
                const point = item.points[index]
                values[item.key] = point && HAS_VALUE(point) ? (point.y as number) : undefined
                return values
            }, {})
        })
    }

    const OnLeave = () => {
        setHover(undefined)
        if(onHover) onHover(undefined)
    }

    const hovered = hover && hasData ? reference.points[hover.index] : undefined

    const BAND_TONE:Record<ChartBandTone, string> = {
        success : palette.states.success,
        warning : palette.states.warning,
        danger  : palette.states.danger,
        info    : palette.states.info,
        neutral : palette.states.neutral
    }

    return <div className={`mp-chart ${className}`.trim()} ref={wrapperRef}>
        <div className="mp-chart__plot" onMouseMove={OnMove} onMouseLeave={OnLeave}>
            {/* preserveAspectRatio="none": com a largura medida certa não há
                distorção, e no frame em que ela ainda estiver defasada o
                desenho estica DENTRO da caixa em vez de vazar dela. */}
            <svg
                width="100%"
                height={height}
                viewBox={`0 0 ${width} ${height}`}
                preserveAspectRatio="none"
                role="img"
                aria-label="série temporal">

                <g transform={`translate(${marginLeft},${MARGIN.top})`}>
                    {
                        bands.map((band, index) => {
                            const top    = y(Math.min(band.to !== undefined ? band.to : domain.yTop, domain.yTop))
                            const bottom = y(Math.max(band.from, domain.yBottom))
                            return <rect
                                key={`band-${index}`}
                                className="mp-chart__band"
                                x={0}
                                y={Math.min(top, bottom)}
                                width={plotWidth}
                                height={Math.max(0, Math.abs(bottom - top))}
                                fill={BAND_TONE[band.tone || "warning"]}>
                                { band.label && <title>{band.label}</title> }
                            </rect>
                        })
                    }

                    {
                        showGrid && gridValues.map((value) => <line
                            key={`grid-${value}`}
                            className="mp-chart__grid"
                            x1={0} x2={plotWidth}
                            y1={y(value)} y2={y(value)}
                            stroke={palette.grid}/>)
                    }

                    {
                        hasData && painted.map((item) => <g key={item.key}>
                            {
                                item.area !== false &&
                                <path
                                    className="mp-chart__area"
                                    d={BuildPathArea(item.points) || undefined}
                                    fill={item.color}/>
                            }
                            <path
                                className={`mp-chart__line ${item.dashed ? "is-dashed" : ""}`.trim()}
                                d={BuildPathLine(item.points) || undefined}
                                stroke={item.color}/>
                        </g>)
                    }

                    {
                        hovered &&
                        <line
                            className="mp-chart__cursor"
                            x1={x(new Date(hovered.x))} x2={x(new Date(hovered.x))}
                            y1={0} y2={plotHeight}
                            stroke={palette.lineSoft}/>
                    }

                    {
                        hover && hasData && painted.map((item) => {
                            const point = item.points[hover.index]
                            if(!point || !HAS_VALUE(point)) return null
                            return <circle
                                key={`marker-${item.key}`}
                                className="mp-chart__marker"
                                cx={x(new Date(point.x))}
                                cy={y(point.y as number)}
                                r={3.5}
                                fill={item.color}
                                stroke={palette.surface}/>
                        })
                    }
                </g>

                {
                    showAxis && <>
                        <g ref={yAxisRef} className="mp-chart__axis" transform={`translate(${marginLeft},${MARGIN.top})`}/>
                        <g ref={xAxisRef} className="mp-chart__axis" transform={`translate(${marginLeft},${MARGIN.top + plotHeight})`}/>
                    </>
                }

                {
                    !hasData &&
                    <text
                        className="mp-chart__empty"
                        x={marginLeft + plotWidth / 2}
                        y={MARGIN.top + plotHeight / 2}
                        textAnchor="middle"
                        fill={palette.muted}>
                        {emptyLabel}
                    </text>
                }
            </svg>

            {
                hovered &&
                <div
                    className="mp-chart__tip"
                    style={{ left: Math.min(Math.max(hover!.left + 12, 0), Math.max(0, width - 180)) }}>
                    <div className="mp-chart__tip-time">{formatTime(hovered.x)}</div>
                    {
                        painted.map((item) => {
                            const point = item.points[hover!.index]
                            return <div key={item.key} className="mp-chart__tip-row">
                                <span className="mp-chart__swatch" style={{ background: item.color }}/>
                                <span className="mp-chart__tip-label">{item.label}</span>
                                <span className="mp-chart__tip-value">
                                    { point && HAS_VALUE(point) ? formatValue(point.y as number) : "—" }
                                </span>
                            </div>
                        })
                    }
                </div>
            }
        </div>

        {
            showLegend && painted.length > 0 &&
            <div className="mp-chart__legend">
                {
                    painted.map((item) => <span key={item.key} className="mp-chart__legend-item">
                        <span className="mp-chart__swatch" style={{ background: item.color }}/>
                        <span title={item.label}>{item.label}</span>
                    </span>)
                }
                {
                    bands.filter((band) => band.label).map((band, index) =>
                        <span key={`band-legend-${index}`} className="mp-chart__legend-item">
                            <span
                                className="mp-chart__swatch is-band"
                                style={{ background: BAND_TONE[band.tone || "warning"] }}/>
                            <span>{band.label}</span>
                        </span>)
                }
            </div>
        }
    </div>
}

export default TimeSeriesChart
