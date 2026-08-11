import * as React from "react"
import { useEffect, useState } from "react"
import { Banner, EmptyState, Spinner } from "@i-components"

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
                if(!cancelado) setErro(e?.message || "could not list the logs of this environment")
            } finally {
                if(!cancelado) setCarregando(false)
            }
        }

        if(environmentName) _Carregar()

        return () => { cancelado = true }

    }, [ environmentName ])

    if(carregando) return <Spinner label="loading environment logs"/>
    if(erro) return <Banner tone="danger" title="logs unavailable">{erro}</Banner>

    if(arquivos.length === 0)
        return <EmptyState
                    icon="file alternate outline"
                    title="No logs yet"
                    message="This environment has not written any log file."/>

    /* A troca de dia fica no próprio viewer, junto dos demais controles. */
    return <LogViewer
                serverManagerInformation={serverManagerInformation}
                filePath={escolhido?.path}
                fileName={escolhido?.name}
                siblings={arquivos}
                onSelectSibling={(arquivo:any) => setEscolhido(arquivo)}/>
}

export default EnvironmentLogsTab
