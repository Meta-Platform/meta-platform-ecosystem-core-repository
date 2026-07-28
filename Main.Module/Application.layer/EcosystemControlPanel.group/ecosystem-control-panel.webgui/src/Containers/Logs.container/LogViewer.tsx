import * as React from "react"
import { useEffect, useRef, useState } from "react"
import {
	Segment,
	Input,
	Dropdown,
	Button,
	Icon,
	Label,
	Loader
} from "semantic-ui-react"

import GetAPI from "../../Utils/GetAPI"

/*
 * A tela de leitura de um arquivo de log.
 *
 * O arquivo é JSONL e pode ter dezenas de MB: nunca é carregado inteiro. A API
 * devolve uma FATIA e um `offset`, e é esse offset que torna o acompanhamento
 * incremental — o follow pede só o que foi escrito depois.
 */

const NIVEIS = ["trace", "debug", "info", "message", "warn", "error", "fatal"]

const COR_POR_NIVEL:any = {
	trace   : "#9aa0a6",
	debug   : "#7e57c2",
	info    : "#1565c0",
	message : "#2e7d32",
	warn    : "#ef6c00",
	error   : "#c62828",
	fatal   : "#b71c1c"
}

/* Seleção MÚLTIPLA: o backend entende lista como conjunto exato de níveis. */
const OPCOES_DE_NIVEL = NIVEIS.map((nivel) => ({ key : nivel, value : nivel, text : nivel }))

const LogViewer = ({ serverManagerInformation, filePath, fileName, siblings, onSelectSibling }:any) => {

	const [ registros, setRegistros ] = useState<any[]>([])
	const [ carregando, setCarregando ] = useState<boolean>(false)
	const [ acompanhando, setAcompanhando ] = useState<boolean>(false)
	const [ niveis, setNiveis ] = useState<string[]>([])
	const [ source, setSource ] = useState<string>("")
	const [ busca, setBusca ] = useState<string>("")
	const [ erro, setErro ] = useState<string>("")

	const fimDaListaRef = useRef<any>(null)
	const websocketRef  = useRef<any>(null)

	const _GetLogsAPI = () => GetAPI({ apiName : "Logs", serverManagerInformation })

	const _Carregar = async () => {

		if(!filePath) return

		setCarregando(true)
		setErro("")

		try {
			const resposta = await _GetLogsAPI().ReadLog({
				path   : filePath,
				level  : niveis.length ? niveis : undefined,
				source : source || undefined,
				text   : busca || undefined
			})
			setRegistros(resposta.data?.records || [])
		} catch(e:any) {
			setErro(e?.message || "não foi possível ler o log")
			setRegistros([])
		} finally {
			setCarregando(false)
		}
	}

	/* Recarrega ao trocar de arquivo ou de filtro. */
	useEffect(() => { _Carregar() }, [ filePath, niveis, source, busca ])

	/* Follow: assina o stream e ancora no fim. */
	useEffect(() => {

		if(!acompanhando || !filePath) return

		const { protocol, host } = window.location
		const esquema = protocol === "https:" ? "wss:" : "ws:"
		const url = `${esquema}//${host}/${process.env.SERVER_APP_NAME}/logs/stream/${encodeURIComponent(filePath)}`

		let websocket:any

		try {
			websocket = new WebSocket(url)
			websocketRef.current = websocket

			websocket.onmessage = (evento:any) => {
				try {
					const resultado = JSON.parse(evento.data)
					if(resultado?.records?.length)
						setRegistros((anteriores) => [ ...anteriores, ...resultado.records ].slice(-2000))
				} catch(e) {}
			}

			websocket.onerror = () => setErro("o acompanhamento ao vivo caiu")
		} catch(e) {
			setErro("não foi possível abrir o acompanhamento ao vivo")
		}

		return () => { try { websocket && websocket.close() } catch(e) {} }

	}, [ acompanhando, filePath ])

	/* Com o follow ligado, a tela segue o fim. */
	useEffect(() => {
		if(acompanhando && fimDaListaRef.current)
			fimDaListaRef.current.scrollIntoView({ behavior : "smooth" })
	}, [ registros, acompanhando ])

	if(!filePath)
		return <Segment placeholder textAlign="center">
					<Icon name="file alternate outline" size="huge" color="grey"/>
					<p style={{ marginTop : 12, color : "#666" }}>Escolha um log na árvore ao lado.</p>
				</Segment>

	return <Segment.Group>

		<Segment secondary style={{ display : "flex", gap : 8, alignItems : "center", flexWrap : "wrap" }}>

			<Icon name="file alternate"/>

			{
				/* Navegação por dia: os outros arquivos do MESMO log. */
				siblings && siblings.length > 1
					? <Dropdown
						selection
						compact
						value={filePath}
						options={siblings.map((irmao:any) => ({ key : irmao.path, value : irmao.path, text : irmao.name }))}
						onChange={(_:any, { value }:any) => onSelectSibling && onSelectSibling(siblings.find((i:any) => i.path === value))}
						style={{ minWidth : 190, marginRight : 8 }}/>
					: <strong style={{ marginRight : 8 }}>{fileName || filePath}</strong>
			}

			<Dropdown
				selection
				multiple
				clearable
				placeholder="todos os níveis"
				options={OPCOES_DE_NIVEL}
				value={niveis}
				onChange={(_:any, { value }:any) => setNiveis(value)}
				style={{ minWidth : 220 }}/>

			<Input
				icon="code"
				iconPosition="left"
				placeholder="source"
				value={source}
				onChange={(_:any, { value }:any) => setSource(value)}
				style={{ width : 160 }}/>

			<Input
				icon="search"
				iconPosition="left"
				placeholder="buscar no texto"
				value={busca}
				onChange={(_:any, { value }:any) => setBusca(value)}
				style={{ width : 200 }}/>

			<Button
				size="small"
				icon
				labelPosition="left"
				color={acompanhando ? "green" : undefined}
				onClick={() => setAcompanhando(!acompanhando)}>
				<Icon name={acompanhando ? "pause" : "play"}/>
				{acompanhando ? "acompanhando" : "acompanhar"}
			</Button>

			<Button size="small" icon="refresh" onClick={_Carregar} title="recarregar"/>

			<Label basic size="small">{registros.length} linha(s)</Label>
		</Segment>

		<Segment style={{ maxHeight : "60vh", overflow : "auto", background : "#fbfbfb", fontFamily : "monospace", fontSize : 12 }}>

			{ carregando && <Loader active inline="centered" size="small"/> }
			{ erro && <Label color="red" basic>{erro}</Label> }

			{
				!carregando && registros.length === 0 &&
				<p style={{ color : "#777" }}>Nenhuma linha para o filtro atual.</p>
			}

			{
				registros.map((registro:any, indice:number) =>
					<div key={indice} style={{ padding : "2px 0", borderBottom : "1px solid #f0f0f0", whiteSpace : "pre-wrap", wordBreak : "break-word" }}>
						{
							registro.raw
								? <>
									<Label size="mini" color="grey" style={{ marginRight : 6 }} title="linha sem estrutura: veio do stdout de um processo">
										raw
									</Label>
									<span style={{ color : "#555" }}>{registro.message}</span>
								</>
								: <>
									<span style={{ color : "#999" }}>{registro.ts}</span>
									{" "}
									<span style={{ color : COR_POR_NIVEL[registro.level] || "#333", fontWeight : 600 }}>
										{String(registro.level || "").padEnd(7)}
									</span>
									{" "}
									<span style={{ color : "#00695c" }}>[{registro.source}]</span>
									{" "}
									<span>{registro.message}</span>
									{
										registro.data &&
										<div style={{ color : "#8d6e63", paddingLeft : 24 }}>
											{JSON.stringify(registro.data)}
										</div>
									}
								</>
						}
					</div>
				)
			}

			<div ref={fimDaListaRef}/>
		</Segment>
	</Segment.Group>
}

export default LogViewer
