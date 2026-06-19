import * as React from "react"
import { useState, useEffect } from "react"

import { Loader, Segment } from "semantic-ui-react"

import GetAPI from "../../Utils/GetAPI"

import ExecutableInformation from "./ExecutableInformation"

// A seleção do executável é feita pela árvore "Executables" na sidebar
// (EcosystemNavigator). Este painel mostra apenas os detalhes do executável
// selecionado — sem lista interna redundante.
const ExecutablesContainer = ({ serverManagerInformation, selectedExecutableName }:any) => {

    const [ executableInformation, setExecutableInformation ] = useState<any>()
    const [ isLoading, setIsLoading ]                         = useState(false)

    const _GetExecutablesAPI = () =>
        GetAPI({ apiName: "Executables", serverManagerInformation })

    useEffect(() => {
        if(selectedExecutableName)
            fetchExecutableInformation()
        else
            setExecutableInformation(undefined)
    }, [selectedExecutableName])

    const fetchExecutableInformation = async () => {
        try {
            setIsLoading(true)
            setExecutableInformation(undefined)
            const response = await _GetExecutablesAPI().GetExecutableInformation({ executableName: selectedExecutableName })
            setExecutableInformation(response.data)
        } catch(e) {
            console.log(e)
        } finally {
            setIsLoading(false)
        }
    }

    return <Segment style={{ margin: "15px" }}>
        {
            isLoading
            ? <Loader active style={{ margin: "50px" }}/>
            : <ExecutableInformation
                executableInformation={executableInformation}
                serverManagerInformation={serverManagerInformation}/>
        }
    </Segment>
}

export default ExecutablesContainer
