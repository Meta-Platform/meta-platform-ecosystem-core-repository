import * as React from "react"
import { useEffect, useState } from "react"

import {
	Banner,
	SearchInput,
	SkeletonList,
	TreeRow
} from "@i-components"

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

	const _RenderArquivos = (arquivos:any[], profundidade:number, prefixo?:string) =>
		arquivos
			.filter((arquivo:any) => _Casa(`${prefixo || ""} ${arquivo.name}`))
			.map((arquivo:any) =>
				<TreeRow
					key={arquivo.path}
					depth={profundidade}
					icon="file alternate outline"
					label={arquivo.name}
					meta={FormatarTamanho(arquivo.size)}
					selected={selecionado?.path === arquivo.path}
					onSelect={() => { setSelecionado(arquivo); setIrmaos(arquivos) }}/>
			)

	const _RenderSecao = (secao:any) => {

		const conteudo = arvore?.[secao.chave]
		const estaAberta = Boolean(abertas[secao.chave])

		/* ecosystem e instances são listas de arquivo; applications e environments agrupam. */
		const ehAgrupada = secao.chave === "applications" || secao.chave === "environments"
		const quantidade = ehAgrupada
			? (conteudo || []).reduce((total:number, grupo:any) => total + (grupo.files?.length || 0), 0)
			: (conteudo || []).length

		const _Alternar = () => setAbertas({ ...abertas, [secao.chave] : !estaAberta })

		return <React.Fragment key={secao.chave}>

			<TreeRow
				depth={0}
				icon={secao.icone}
				label={secao.titulo}
				meta={quantidade}
				hasChildren={true}
				expanded={estaAberta}
				onToggle={_Alternar}
				onSelect={_Alternar}/>

			{
				estaAberta && <>
					<div className="ecp-logs-tree__help">{secao.ajuda}</div>
					{
						quantidade === 0
							? <div className="ecp-logs-tree__none">nada gravado ainda</div>
							: ehAgrupada
								? (conteudo || []).map((grupo:any) =>
									<React.Fragment key={grupo.name}>
										<TreeRow depth={1} icon="folder" label={grupo.name}/>
										{ _RenderArquivos(grupo.files || [], 2, grupo.name) }
									</React.Fragment>)
								: _RenderArquivos(conteudo || [], 1)
					}
				</>
			}

		</React.Fragment>
	}

	return <div className="ecp-logs">

		<aside className="mp-surface ecp-logs-tree">

			<div className="ecp-logs-tree__filter ecp-fixed">
				<SearchInput
					value={filtroDaArvore}
					onValueChange={(valor:string) => setFiltroDaArvore(valor)}
					placeholder="filtrar arquivos"/>
			</div>

			<div className="ecp-logs-tree__body">
				{ carregando && <SkeletonList rows={6}/> }
				{ erro && <Banner tone="danger">{erro}</Banner> }
				{ !carregando && !erro && SECOES.map(_RenderSecao) }
			</div>

		</aside>

		<section className="ecp-logs-viewer">
			<LogViewer
				serverManagerInformation={serverManagerInformation}
				filePath={selecionado?.path}
				fileName={selecionado?.name}
				siblings={irmaos}
				onSelectSibling={(arquivo:any) => setSelecionado(arquivo)}/>
		</section>

	</div>
}

export default LogsContainer
