import * as React from "react"
import { useEffect, useState } from "react"
import { Loader, Label, Dropdown, Segment } from "semantic-ui-react"

import GetAPI from "../../Utils/GetAPI"
import LogViewer from "../Logs.container/LogViewer"

/*
 * O log DAQUELE ambiente, ao lado das abas de plano de execução e metadados.
 *
 * O ambiente tem o seu próprio `logs/` (ver environment-runtime-standard.md), e
 * é ele que responde "o que aconteceu nesta execução deste pacote" — sem
 * precisar caçar no log central do ecossistema.
 */
const EnvironmentLogsTab = ({ serverManagerInformation, environmentName }:any) => {

    const [ arquivos, setArquivos ] = useState<any[]>([])
    const [ escolhido, setEscolhido ] = useState<any>(null)
    const [ carregando, setCarregando ] = useState<boolean>(true)
    const [ erro, setErro ] = useState<string>("")

    useEffect(() => {

        let cancelado = false

        const _Carregar = async () => {
            setCarregando(true)
            setErro("")
            try {
                const resposta = await GetAPI({ apiName : "Logs", serverManagerInformation }).GetLogTree()
                if(cancelado) return

                const ambiente = (resposta.data?.environments || [])
                    .find((item:any) => item.name === environmentName)

                const lista = ambiente?.files || []
                setArquivos(lista)
                /* O mais recente é o que interessa ao abrir. */
                setEscolhido(lista.length ? lista[lista.length - 1] : null)
            } catch(e:any) {
                if(!cancelado) setErro(e?.message || "não foi possível listar o log deste ambiente")
            } finally {
                if(!cancelado) setCarregando(false)
            }
        }

        if(environmentName) _Carregar()

        return () => { cancelado = true }

    }, [ environmentName ])

    if(carregando) return <Loader active inline="centered"/>
    if(erro) return <Label color="red" basic>{erro}</Label>

    if(arquivos.length === 0)
        return <Segment basic textAlign="center" style={{ color : "#777" }}>
                    Este ambiente ainda não gravou log.
                </Segment>

    return <>
        {
            arquivos.length > 1 &&
            <Dropdown
                selection
                compact
                value={escolhido?.path}
                options={arquivos.map((arquivo:any) => ({ key : arquivo.path, value : arquivo.path, text : arquivo.name }))}
                onChange={(_:any, { value }:any) => setEscolhido(arquivos.find((a:any) => a.path === value))}
                style={{ marginBottom : 8 }}/>
        }

        <LogViewer
            serverManagerInformation={serverManagerInformation}
            filePath={escolhido?.path}
            fileName={escolhido?.name}/>
    </>
}

export default EnvironmentLogsTab
