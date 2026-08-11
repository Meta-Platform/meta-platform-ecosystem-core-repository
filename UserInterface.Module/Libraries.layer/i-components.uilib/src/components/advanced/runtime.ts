// Componentes pesados de RUNTIME: os que mostram um processo vivo.
// Terminal (xterm), TimeSeriesChart (d3) e LogViewer.
//
// Vivem num barril próprio porque trazem dependência de terceiro para dentro do
// bundle. Quem só quer um botão não deve pagar por xterm — mas o barril é
// reexportado pelo índice do kit, então o import continua sendo `@i-components`.

export { default as Terminal, BuildTerminalTheme } from "./Terminal"
export type { TerminalHandle, TerminalProps, TerminalSize } from "./Terminal"

export { default as TimeSeriesChart } from "./TimeSeriesChart"
export type {
    TimeSeriesChartProps,
    TimeSeries,
    TimeSeriesPoint,
    TimeSeriesHover,
    ChartBand,
    ChartBandTone
} from "./TimeSeriesChart"

export { default as LogViewer, LOG_LEVELS, ParseAnsi, StripAnsi } from "./LogViewer"
export type { LogEntry, LogViewerProps, AnsiSegment } from "./LogViewer"
