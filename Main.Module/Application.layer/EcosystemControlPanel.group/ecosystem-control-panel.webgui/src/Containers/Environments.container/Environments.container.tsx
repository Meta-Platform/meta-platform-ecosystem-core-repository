import * as React from "react"
import { useState, useEffect } from "react"
import { connect }            from "react-redux"
import { bindActionCreators } from "redux"
import { Button, Icon, Input, Label, Segment, Table } from "semantic-ui-react"
import qs from "query-string"
import {
	useNavigate
  } from "react-router-dom"

import QueryParamsActionsCreator from "../../Actions/QueryParams.actionsCreator"
import GetAPI from "../../Utils/GetAPI"
import Breadcrumbs from "../../Components/Breadcrumbs"
import ListSkeleton from "../../Components/Skeleton"
import EmptyState from "../../Components/EmptyState"
import EntityHeader from "../../Components/ui/EntityHeader"
import { ShortId } from "../../Utils/Format"
import { toastSuccess, toastError, errorMessage } from "../../Utils/toast"

import EnvironmentDetailsTab from "./EnvironmentDetailsTab"

const ExtractPackageIdentity = (environmentName:string) => {
    const index = environmentName.lastIndexOf('-')
    return index !== -1 ? environmentName.slice(0, index) : environmentName
}

const ExtractEnvironmentHash = (environmentName:string) => {
    const index = environmentName.lastIndexOf('-')
    return index !== -1 ? environmentName.slice(index + 1) : environmentName
}

const ExtractType = (identity:string) => {
    const i = identity.lastIndexOf(".")
    return i !== -1 ? identity.slice(i + 1) : ""
}

// Como há muitos environments, o menu Environments NÃO os lista na sidebar.
// Este painel mostra a lista (agrupada por identidade de pacote, pois mudar o
// pacote de lugar gera novo hash) e, ao selecionar, os detalhes.
const GroupByIdentity = (names:string[]) =>
    names.reduce((acc:any, name:string) => {
        const id = ExtractPackageIdentity(name)
        ;(acc[id] = acc[id] || []).push(name)
        return acc
    }, {})

const EnvironmentsContainer = ({
    HTTPServerManager,
    AddQueryParam,
    RemoveQueryParam,
    QueryParams
 }:any) => {

    const [ environmentNameList, setEnvironmentNameList ] = useState<string[]>([])
    const [ isLoadingList, setIsLoadingList ] = useState(true)
    const [ filterValue, setFilterValue ] = useState<string>("")
    const [ openGroups, setOpenGroups ] = useState<any>({})

    const [ environmentNameSelected, setEnvironmentNameSelected ] = useState<string>()
    const [ metadataHierarchySelected, setMetadataHierarchySelected] = useState()
    const [ executionParamsSelected, setExecutionParamsSelected] = useState()

  	const navigate = useNavigate()

    useEffect(() => { fetchEnvironmentsList() }, [])

    useEffect(() => {
        setMetadataHierarchySelected(undefined)
        setExecutionParamsSelected(undefined)
		if(environmentNameSelected){
            fetchMetadataHierarchy()
            fetchExecutionParams()
        }
	}, [environmentNameSelected])

    useEffect(() => {
		const search = qs.stringify(QueryParams)
		navigate({search: `?${search}`})
        // sincroniza nos dois sentidos (voltar para a lista limpa o param)
		setEnvironmentNameSelected(QueryParams.environmentName || undefined)
	}, [QueryParams])

    const getEnviromentAPI = () =>
        GetAPI({ apiName:"Environments", serverManagerInformation:HTTPServerManager })

    const fetchEnvironmentsList = async () => {
        try {
            const response = await getEnviromentAPI().ListEnvironments()
            setEnvironmentNameList(response.data)
        } catch(e) { console.log(e) } finally { setIsLoadingList(false) }
    }

    const fetchExecutionParams = async () => {
        const response = await getEnviromentAPI().GetExecutionParams({environmentName: environmentNameSelected})
        setExecutionParamsSelected(response.data)
    }

    const fetchMetadataHierarchy = async () => {
        const response = await getEnviromentAPI().GetMetadataHierarchy({environmentName: environmentNameSelected})
        setMetadataHierarchySelected(response.data)
    }

    const handleSaveExecutionParams = async (executionParams:any) => {
        try {
            await getEnviromentAPI().SaveExecutionParams({ environmentName: environmentNameSelected, executionParams })
            await fetchExecutionParams()
            toastSuccess("Execution plan saved")
        } catch(e) { toastError(errorMessage(e)); throw e }
    }

    const selectEnvironment = (name:string) => AddQueryParam("environmentName", name)
    const backToList = () => RemoveQueryParam("environmentName")

    // ---- DETALHE ----
    if(environmentNameSelected)
        return <Segment style={{ margin: "15px" }}>
            <Breadcrumbs items={[ "Environments", ExtractPackageIdentity(environmentNameSelected), ShortId(ExtractEnvironmentHash(environmentNameSelected), 8, 6) ]}/>
            <EntityHeader
                icon="sitemap"
                title={ExtractPackageIdentity(environmentNameSelected)}
                subtitle={`environments / ${environmentNameSelected}`}
                typeLabel={ExtractType(ExtractPackageIdentity(environmentNameSelected))}
                technicalRef={{ label: "hash", value: ExtractEnvironmentHash(environmentNameSelected), maxChars: 20 }}
                actions={
                    <Button size="small" basic icon labelPosition="left" onClick={backToList}>
                        <Icon name="arrow left"/> list
                    </Button>
                }/>
            <EnvironmentDetailsTab
                metadataHierarchy={metadataHierarchySelected}
                executionParams={executionParamsSelected}
                onSaveExecutionParams={handleSaveExecutionParams}/>
        </Segment>

    // ---- LISTA ----
    const filtered = environmentNameList.filter((n) => !filterValue || n.toLowerCase().includes(filterValue.toLowerCase()))
    const grouped = GroupByIdentity(filtered)
    const identities = Object.keys(grouped).sort()

    return <Segment style={{ margin: "10px", height: "calc(100vh - 110px)", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "10px", flex: "0 0 auto" }}>
            <Label size="large"><Icon name="sitemap"/> {environmentNameList.length} environments</Label>
            <Label basic>{identities.length} packages</Label>
            <Input icon="search" size="small" placeholder="filter environments..." value={filterValue}
                onChange={(e, { value }) => setFilterValue(value)} style={{ marginLeft: "auto" }}/>
        </div>

        {
            isLoadingList
            ? <ListSkeleton lines={10}/>
            : identities.length === 0
                ? <EmptyState icon="sitemap" title="No environments" description="Run a package to generate an environment."/>
                : <div style={{ overflow: "auto", flex: "1 1 auto", minHeight: 0 }}>
                    <Table celled striped compact>
                        <Table.Header>
                            <Table.Row>
                                <Table.HeaderCell width={8}>package</Table.HeaderCell>
                                <Table.HeaderCell width={2}>type</Table.HeaderCell>
                                <Table.HeaderCell width={3}>instances</Table.HeaderCell>
                                <Table.HeaderCell width={3}></Table.HeaderCell>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {
                                identities.map((identity:string, gi:number) => {
                                    const instances = grouped[identity]
                                    const isOpen = openGroups[identity]
                                    const rows:any[] = []
                                    rows.push(
                                        <Table.Row key={`g-${gi}`} style={{ cursor: instances.length > 1 ? "pointer" : "default" }}
                                            onClick={() => instances.length > 1 ? setOpenGroups({ ...openGroups, [identity]: !isOpen }) : selectEnvironment(instances[0])}>
                                            <Table.Cell>
                                                { instances.length > 1 && <Icon name={isOpen ? "caret down" : "caret right"} style={{ color: "var(--mp-muted-2)" }}/> }
                                                <Icon name="cube" style={{ color: "var(--mp-muted)" }}/> <strong>{identity}</strong>
                                            </Table.Cell>
                                            <Table.Cell><Label size="mini">{ExtractType(identity)}</Label></Table.Cell>
                                            <Table.Cell>{instances.length}</Table.Cell>
                                            <Table.Cell textAlign="right">
                                                {
                                                    instances.length === 1 &&
                                                    <span style={{ color: "var(--mp-accent-blue)" }}>open <Icon name="arrow right"/></span>
                                                }
                                            </Table.Cell>
                                        </Table.Row>
                                    )
                                    if(instances.length > 1 && isOpen)
                                        instances.forEach((name:string, ii:number) =>
                                            rows.push(
                                                <Table.Row key={`i-${gi}-${ii}`} style={{ cursor: "pointer" }} onClick={() => selectEnvironment(name)}>
                                                    <Table.Cell style={{ paddingLeft: "34px", fontFamily: "monospace", color: "var(--mp-ink-3)" }}>
                                                        <Icon name="hashtag" style={{ color: "var(--mp-muted-2)" }}/> {ShortId(ExtractEnvironmentHash(name), 12, 8)}
                                                    </Table.Cell>
                                                    <Table.Cell/>
                                                    <Table.Cell/>
                                                    <Table.Cell textAlign="right"><span style={{ color: "var(--mp-accent-blue)" }}>open <Icon name="arrow right"/></span></Table.Cell>
                                                </Table.Row>))
                                    return rows
                                })
                            }
                        </Table.Body>
                    </Table>
                </div>
        }
    </Segment>
}

const mapDispatchToProps = (dispatch:any) => bindActionCreators({
	AddQueryParam    : QueryParamsActionsCreator.AddQueryParam,
	RemoveQueryParam : QueryParamsActionsCreator.RemoveQueryParam
}, dispatch)

const mapStateToProps = ({HTTPServerManager, QueryParams}:any) => ({
	HTTPServerManager,
	QueryParams
})

export default connect(mapStateToProps, mapDispatchToProps)(EnvironmentsContainer)
