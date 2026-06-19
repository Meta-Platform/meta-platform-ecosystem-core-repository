import * as React from "react"
import { useState, useEffect } from "react"
import { connect }            from "react-redux"
import { bindActionCreators } from "redux"
import { Header, Icon, Label, Loader, Segment } from "semantic-ui-react"
import qs from "query-string"
import {
	useNavigate
  } from "react-router-dom"

import QueryParamsActionsCreator from "../../Actions/QueryParams.actionsCreator"
import GetAPI from "../../Utils/GetAPI"
import Breadcrumbs from "../../Components/Breadcrumbs"
import { ShortId } from "../../Utils/Format"
import { toastSuccess, toastError, errorMessage } from "../../Utils/toast"

import EnvironmentDetailsTab from "./EnvironmentDetailsTab"

const ExtractPackageIdentity = environmentName => {
    const index = environmentName.lastIndexOf('-')
    return index !== -1 ? environmentName.slice(0, index) : environmentName
}

const ExtractEnvironmentHash = environmentName => {
    const index = environmentName.lastIndexOf('-')
    return index !== -1 ? environmentName.slice(index + 1) : environmentName
}

// A seleção do environment é feita pela árvore na sidebar (EcosystemNavigator).
// Este painel mostra apenas os detalhes do environment selecionado.
const EnvironmentsContainer = ({
    HTTPServerManager,
    AddQueryParam,
    QueryParams
 }:any) => {

    const [ environmentNameSelected, setEnvironmentNameSelected ] = useState<string>()

    const [ metadataHierarchySelected, setMetadataHierarchySelected] = useState()
    const [ executionParamsSelected, setExecutionParamsSelected] = useState()

  	const navigate = useNavigate()

    useEffect(() => {

        setMetadataHierarchySelected(undefined)
        setExecutionParamsSelected(undefined)
		if(environmentNameSelected){
			AddQueryParam("environmentName", environmentNameSelected)
            fetchMetadataHierarchy()
            fetchExecutionParams()
        }

	}, [environmentNameSelected])


    useEffect(() => {

		const search = qs.stringify(QueryParams)
		navigate({search: `?${search}`})

		if(QueryParams.environmentName)
			setEnvironmentNameSelected(QueryParams.environmentName)

	}, [QueryParams])

    const getEnviromentAPI = () =>
        GetAPI({
            apiName:"Environments",
            serverManagerInformation:HTTPServerManager
        })

    const fetchExecutionParams = async () => {
        const api = getEnviromentAPI()
        const response = await api.GetExecutionParams({environmentName: environmentNameSelected})
        setExecutionParamsSelected(response.data)
    }

    const fetchMetadataHierarchy = async () => {
        const api = getEnviromentAPI()
        const response = await api.GetMetadataHierarchy({environmentName: environmentNameSelected})
        setMetadataHierarchySelected(response.data)
    }

    // Salva o plano de execução editado (alterar detalhes de tarefas) e recarrega.
    const handleSaveExecutionParams = async (executionParams) => {
        try {
            const api = getEnviromentAPI()
            await api.SaveExecutionParams({ environmentName: environmentNameSelected, executionParams })
            await fetchExecutionParams()
            toastSuccess("Plano de execução salvo")
        } catch(e) {
            toastError(errorMessage(e))
            throw e
        }
    }

    if(!environmentNameSelected)
        return <Segment placeholder style={{ margin: "15px", minHeight: "300px" }}>
            <Header icon textAlign="center" style={{ color: "grey" }}>
                <Icon name="sitemap"/>
                Selecione um environment na árvore <strong>Environments</strong> à esquerda
                <Header.Subheader>
                    cada environment é uma execução isolada (pacote + hash do caminho)
                </Header.Subheader>
            </Header>
        </Segment>

    return <Segment style={{ margin: "15px" }}>
        <Breadcrumbs items={[ "Environments", ExtractPackageIdentity(environmentNameSelected), ShortId(ExtractEnvironmentHash(environmentNameSelected), 8, 6) ]}/>
        <Header>
            <Icon name="sitemap"/>
            <Header.Content>
                {ExtractPackageIdentity(environmentNameSelected)}
                <Label size="tiny" style={{ marginLeft: "8px", fontFamily: "monospace" }}>
                    {ExtractEnvironmentHash(environmentNameSelected)}
                </Label>
                <Header.Subheader style={{ wordBreak: "break-all" }}>
                    environments / {environmentNameSelected}
                </Header.Subheader>
            </Header.Content>
        </Header>

        <EnvironmentDetailsTab
            metadataHierarchy={metadataHierarchySelected}
            executionParams={executionParamsSelected}
            onSaveExecutionParams={handleSaveExecutionParams}/>
    </Segment>
}

const mapDispatchToProps = (dispatch:any) => bindActionCreators({
	AddQueryParam    : QueryParamsActionsCreator.AddQueryParam
}, dispatch)

const mapStateToProps = ({HTTPServerManager, QueryParams}:any) => ({
	HTTPServerManager,
	QueryParams
})

export default connect(mapStateToProps, mapDispatchToProps)(EnvironmentsContainer)
