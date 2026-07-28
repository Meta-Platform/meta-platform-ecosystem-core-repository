import * as React from "react"
import { useEffect, useState } from "react"
import { Loader, Label, Segment } from "semantic-ui-react"

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

    /* A troca de dia fica no próprio viewer, junto dos demais controles. */
    return <LogViewer
                serverManagerInformation={serverManagerInformation}
                filePath={escolhido?.path}
                fileName={escolhido?.name}
                siblings={arquivos}
                onSelectSibling={(arquivo:any) => setEscolhido(arquivo)}/>
}

export default EnvironmentLogsTab
