import * as React from "react"
import { useEffect, useRef, useState } from "react"

import {
	Banner,
	Button,
	EmptyState,
	Icon,
	IconButton,
	SearchInput,
	SelectInput,
	Spinner,
	StatusChip,
	TextInput,
	Toolbar
} from "@i-components"

import GetAPI from "../../Utils/GetAPI"

/*
 * A tela de leitura de um arquivo de log.
 *
 * O arquivo é JSONL e pode ter dezenas de MB: nunca é carregado inteiro. A API
 * devolve uma FATIA e um `offset`, e é esse offset que torna o acompanhamento
 * incremental — o follow pede só o que foi escrito depois.
 */

const NIVEIS = ["trace", "debug", "info", "message", "warn", "error", "fatal"]

/* Tom do chip de cada nível (a COR do texto do nível está no CSS, sobre os
   tokens --mp-terminal-*: o corpo do log é uma superfície de terminal). */
const TOM_POR_NIVEL:any = {
	trace   : "neutral",
	debug   : "neutral",
	info    : "info",
	message : "success",
	warn    : "warning",
	error   : "danger",
	fatal   : "danger"
}

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

	/* Liga/desliga um nível: o backend entende a lista como conjunto exato. */
	const _AlternarNivel = (nivel:string) =>
		setNiveis(niveis.includes(nivel)
			? niveis.filter((n) => n !== nivel)
			: [ ...niveis, nivel ])

	if(!filePath)
		return <EmptyState
			icon="file alternate outline"
			title="Nenhum log selecionado"
			message="Escolha um log na árvore ao lado."/>

	return <div className="ecp-log-viewer">

		<Toolbar className="ecp-fixed ecp-log-viewer__bar">

			<Icon name="file alternate" tone="muted"/>

			{
				/* Navegação por dia: os outros arquivos do MESMO log. */
				siblings && siblings.length > 1
					? <SelectInput
						className="ecp-log-viewer__file"
						value={filePath}
						options={siblings.map((irmao:any) => ({ value : irmao.path, label : irmao.name }))}
						onChange={(evento:any) => onSelectSibling && onSelectSibling(siblings.find((i:any) => i.path === evento.target.value))}/>
					: <strong className="ecp-log-viewer__filename">{fileName || filePath}</strong>
			}

			<Toolbar.Separator/>

			{/* Seleção MÚLTIPLA de níveis: chip ligado = nível no conjunto.
			    Nenhum chip ligado = todos os níveis (é o que a API entende). */}
			<span className="ecp-log-viewer__levels">
				{
					NIVEIS.map((nivel) =>
						<StatusChip
							key={nivel}
							label={nivel}
							tone={TOM_POR_NIVEL[nivel]}
							active={niveis.includes(nivel)}
							onClick={() => _AlternarNivel(nivel)}/>)
				}
			</span>

			<Toolbar.Separator/>

			<TextInput
				className="ecp-log-viewer__source"
				placeholder="source"
				value={source}
				onChange={(evento:any) => setSource(evento.target.value)}/>

			<SearchInput
				className="ecp-log-viewer__search"
				placeholder="buscar no texto"
				value={busca}
				onValueChange={(valor:string) => setBusca(valor)}/>

			<Button
				size="sm"
				variant={acompanhando ? "primary" : "default"}
				icon={acompanhando ? "pause" : "play"}
				onClick={() => setAcompanhando(!acompanhando)}>
				{acompanhando ? "acompanhando" : "acompanhar"}
			</Button>

			<IconButton icon="refresh" label="recarregar" size="sm" onClick={_Carregar}/>

			<Toolbar.Spacer/>

			<StatusChip icon="list" count={registros.length} label="linha(s)"/>

		</Toolbar>

		{/* Carregamento e erro ficam FORA do corpo: o corpo é superfície de
		    terminal (escura) e engoliria o girador e a faixa de aviso. */}
		{ carregando && <div className="ecp-log-viewer__loading"><Spinner label="lendo o log…"/></div> }
		{ erro && <Banner tone="danger" className="ecp-fixed">{erro}</Banner> }

		<div className="ecp-log-viewer__body">

			{
				!carregando && registros.length === 0 &&
				<p className="ecp-log-viewer__empty">Nenhuma linha para o filtro atual.</p>
			}

			{
				registros.map((registro:any, indice:number) =>
					<div key={indice} className="ecp-log-line">
						{
							registro.raw
								? <>
									<span className="ecp-log-line__raw" title="linha sem estrutura: veio do stdout de um processo">raw</span>
									<span className="ecp-log-line__message">{registro.message}</span>
								</>
								: <>
									<span className="ecp-log-line__ts">{registro.ts}</span>
									{" "}
									<span className={`ecp-log-line__level ecp-log-line__level--${registro.level || "trace"}`}>
										{String(registro.level || "").padEnd(7)}
									</span>
									{" "}
									<span className="ecp-log-line__source">[{registro.source}]</span>
									{" "}
									<span>{registro.message}</span>
									{
										registro.data &&
										<div className="ecp-log-line__data">
											{JSON.stringify(registro.data)}
										</div>
									}
								</>
						}
					</div>
				)
			}

			<div ref={fimDaListaRef}/>
		</div>
	</div>
}

export default LogViewer
