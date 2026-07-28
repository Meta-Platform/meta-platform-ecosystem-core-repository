import * as React from "react"
import { useEffect, useState } from "react"
import {
	Grid,
	Segment,
	List,
	Icon,
	Loader,
	Label,
	Accordion,
	Input
} from "semantic-ui-react"

import GetAPI from "../../Utils/GetAPI"
import LogViewer from "./LogViewer"

/*
 * O painel de logs: à esquerda a árvore do que existe em disco, à direita o
 * viewer do arquivo escolhido.
 *
 * A árvore vem pronta do backend (GET /logs/tree) — inclusive o caminho de cada
 * arquivo, que volta na leitura. O cliente nunca monta caminho: é o que permite
 * ao backend recusar qualquer coisa fora das áreas de log.
 */

const SECOES = [
	{ chave : "ecosystem",    titulo : "Ecossistema",  icone : "server",  ajuda : "daemon, CLIs, instalação e wizard" },
	{ chave : "applications", titulo : "Aplicações",   icone : "cube",    ajuda : "por pacote de aplicação" },
	{ chave : "instances",    titulo : "Instâncias",   icone : "play",    ajuda : "uma execução por arquivo" },
	{ chave : "environments", titulo : "Ambientes",    icone : "sitemap", ajuda : "o log de dentro de cada ambiente" }
]

const FormatarTamanho = (bytes:number) => {
	if(!bytes) return "0 B"
	if(bytes < 1024) return `${bytes} B`
	if(bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const LogsContainer = ({ serverManagerInformation }:any) => {

	const [ arvore, setArvore ] = useState<any>(null)
	const [ carregando, setCarregando ] = useState<boolean>(true)
	const [ erro, setErro ] = useState<string>("")
	const [ selecionado, setSelecionado ] = useState<any>(null)
	/* Os outros arquivos do MESMO log — é o que permite navegar por dia. */
	const [ irmaos, setIrmaos ] = useState<any[]>([])
	const [ abertas, setAbertas ] = useState<any>({ ecosystem : true })
	const [ filtroDaArvore, setFiltroDaArvore ] = useState<string>("")

	const _Carregar = async () => {
		setCarregando(true)
		setErro("")
		try {
			const resposta = await GetAPI({ apiName : "Logs", serverManagerInformation }).GetLogTree()
			setArvore(resposta.data)
		} catch(e:any) {
			setErro(e?.message || "não foi possível listar os logs")
		} finally {
			setCarregando(false)
		}
	}

	useEffect(() => { _Carregar() }, [])

	const _Casa = (texto:string) =>
		!filtroDaArvore || String(texto).toLowerCase().includes(filtroDaArvore.toLowerCase())

	const _RenderArquivos = (arquivos:any[], prefixo?:string) =>
		arquivos
			.filter((arquivo:any) => _Casa(`${prefixo || ""} ${arquivo.name}`))
			.map((arquivo:any) =>
				<List.Item
					key={arquivo.path}
					active={selecionado?.path === arquivo.path}
					onClick={() => { setSelecionado(arquivo); setIrmaos(arquivos) }}
					style={{
						cursor : "pointer",
						padding : "4px 8px",
						background : selecionado?.path === arquivo.path ? "#e8f0fe" : undefined,
						borderRadius : 4
					}}>
					<List.Icon name="file alternate outline" size="small"/>
					<List.Content>
						<List.Header style={{ fontSize : 12 }}>{arquivo.name}</List.Header>
						<List.Description style={{ fontSize : 11, color : "#888" }}>
							{FormatarTamanho(arquivo.size)}
						</List.Description>
					</List.Content>
				</List.Item>
			)

	const _RenderSecao = (secao:any) => {

		const conteudo = arvore?.[secao.chave]
		const estaAberta = Boolean(abertas[secao.chave])

		/* ecosystem e instances são listas de arquivo; applications e environments agrupam. */
		const ehAgrupada = secao.chave === "applications" || secao.chave === "environments"
		const quantidade = ehAgrupada
			? (conteudo || []).reduce((total:number, grupo:any) => total + (grupo.files?.length || 0), 0)
			: (conteudo || []).length

		return <React.Fragment key={secao.chave}>
			<Accordion.Title
				active={estaAberta}
				onClick={() => setAbertas({ ...abertas, [secao.chave] : !estaAberta })}
				style={{ padding : "8px 4px" }}>
				<Icon name={estaAberta ? "chevron down" : "chevron right"} size="small"/>
				<Icon name={secao.icone}/>
				<strong>{secao.titulo}</strong>
				<Label circular size="mini" style={{ marginLeft : 6 }}>{quantidade}</Label>
				<div style={{ fontSize : 11, color : "#999", marginLeft : 26 }}>{secao.ajuda}</div>
			</Accordion.Title>

			<Accordion.Content active={estaAberta}>
				{
					quantidade === 0
						? <p style={{ fontSize : 11, color : "#aaa", paddingLeft : 26 }}>nada gravado ainda</p>
						: <List style={{ paddingLeft : 18 }}>
							{
								ehAgrupada
									? (conteudo || []).map((grupo:any) =>
										<List.Item key={grupo.name}>
											<List.Content>
												<List.Header style={{ fontSize : 12, color : "#444" }}>{grupo.name}</List.Header>
												<List style={{ paddingLeft : 10 }}>{_RenderArquivos(grupo.files || [], grupo.name)}</List>
											</List.Content>
										</List.Item>
									)
									: _RenderArquivos(conteudo || [])
							}
						</List>
				}
			</Accordion.Content>
		</React.Fragment>
	}

	return <Grid stackable>
		<Grid.Column width={5}>
			<Segment style={{ maxHeight : "75vh", overflow : "auto" }}>

				<Input
					fluid
					size="small"
					icon="filter"
					iconPosition="left"
					placeholder="filtrar arquivos"
					value={filtroDaArvore}
					onChange={(_:any, { value }:any) => setFiltroDaArvore(value)}
					style={{ marginBottom : 10 }}/>

				{ carregando && <Loader active inline="centered" size="small"/> }
				{ erro && <Label color="red" basic>{erro}</Label> }

				{ !carregando && !erro && <Accordion fluid>{SECOES.map(_RenderSecao)}</Accordion> }
			</Segment>
		</Grid.Column>

		<Grid.Column width={11}>
			<LogViewer
				serverManagerInformation={serverManagerInformation}
				filePath={selecionado?.path}
				fileName={selecionado?.name}
				siblings={irmaos}
				onSelectSibling={(arquivo:any) => setSelecionado(arquivo)}/>
		</Grid.Column>
	</Grid>
}

export default LogsContainer
