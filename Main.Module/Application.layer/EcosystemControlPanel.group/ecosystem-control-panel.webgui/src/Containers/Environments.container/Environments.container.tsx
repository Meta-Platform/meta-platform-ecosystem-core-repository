import * as React from "react"
import { useState, useEffect } from "react"
import { connect }            from "react-redux"
import { bindActionCreators } from "redux"
import qs from "query-string"
import {
	useNavigate
  } from "react-router-dom"

import {
    Button,
    DataTable,
    EmptyState,
    EntityHeader,
    Icon,
    PageMasthead,
    SearchInput,
    SkeletonList,
    StatusChip,
    StatusStrip
} from "@i-components"

import QueryParamsActionsCreator from "../../Actions/QueryParams.actionsCreator"
import GetAPI from "../../Utils/GetAPI"
import Breadcrumbs from "../../Components/Breadcrumbs"
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
        return <div className="ecp-env-detail">
            <Breadcrumbs items={[ "Environments", ExtractPackageIdentity(environmentNameSelected), ShortId(ExtractEnvironmentHash(environmentNameSelected), 8, 6) ]}/>
            <EntityHeader
                icon="sitemap"
                title={ExtractPackageIdentity(environmentNameSelected)}
                subtitle={`environments / ${environmentNameSelected}`}
                typeLabel={ExtractType(ExtractPackageIdentity(environmentNameSelected))}
                technicalRef={{ label: "hash", value: ExtractEnvironmentHash(environmentNameSelected), maxChars: 20 }}
                actions={
                    <Button size="sm" variant="subtle" icon="arrow left" onClick={backToList}>
                        list
                    </Button>
                }/>
            <EnvironmentDetailsTab
                metadataHierarchy={metadataHierarchySelected}
                executionParams={executionParamsSelected}
                onSaveExecutionParams={handleSaveExecutionParams}
                serverManagerInformation={HTTPServerManager}
                environmentName={environmentNameSelected}/>
        </div>

    // ---- LISTA ----
    const filtered = environmentNameList.filter((n) => !filterValue || n.toLowerCase().includes(filterValue.toLowerCase()))
    const grouped = GroupByIdentity(filtered)
    const identities = Object.keys(grouped).sort()

    // A tabela do kit é dirigida por DADOS: a árvore (identidade + instâncias
    // abertas) é achatada aqui, e cada linha carrega o que fazer no clique.
    const tableRows:any[] = []
    identities.forEach((identity:string) => {
        const instances = grouped[identity]
        const isOpen = !!openGroups[identity]
        tableRows.push({ kind: "group", key: `g-${identity}`, identity, instances, isOpen })
        if(instances.length > 1 && isOpen)
            instances.forEach((name:string) =>
                tableRows.push({ kind: "instance", key: `i-${name}`, identity, name }))
    })

    const OpenHint = () =>
        <span className="ecp-env-open">open <Icon name="arrow right" size="small"/></span>

    const columns = [
        {
            key: "package",
            header: "package",
            width: "50%",
            render: (row:any) =>
                row.kind === "group"
                ? <span className="ecp-env-group-name">
                    { row.instances.length > 1 && <Icon name={row.isOpen ? "caret down" : "caret right"} tone="muted"/> }
                    <Icon name="cube" tone="muted"/>
                    <strong>{row.identity}</strong>
                </span>
                : <span className="ecp-env-instance-name">
                    <Icon name="hashtag" tone="muted"/>
                    {ShortId(ExtractEnvironmentHash(row.name), 12, 8)}
                </span>
        },
        {
            key: "type",
            header: "type",
            width: "14%",
            render: (row:any) =>
                row.kind === "group" ? <span className="mp-type-chip">{ExtractType(row.identity)}</span> : null
        },
        {
            key: "instances",
            header: "instances",
            width: "16%",
            render: (row:any) => row.kind === "group" ? row.instances.length : null
        },
        {
            key: "action",
            header: "",
            width: "20%",
            align: "right" as const,
            render: (row:any) =>
                row.kind === "instance" || row.instances.length === 1 ? <OpenHint/> : null
        }
    ]

    const handleRowClick = (row:any) => {
        if(row.kind === "instance") return selectEnvironment(row.name)
        if(row.instances.length > 1)
            return setOpenGroups({ ...openGroups, [row.identity]: !row.isOpen })
        return selectEnvironment(row.instances[0])
    }

    return <div className="ecp-env-page">
        <PageMasthead
            icon="sitemap"
            title="Environments"
            subtitle="runtime environment generated for each executed package"/>

        <StatusStrip
            right={
                <SearchInput
                    className="ecp-env-search"
                    value={filterValue}
                    placeholder="filter environments..."
                    onValueChange={setFilterValue}/>
            }>
            <StatusChip icon="sitemap" count={environmentNameList.length} label="environments"/>
            <StatusChip icon="cube" count={identities.length} label="packages" tone="info"/>
        </StatusStrip>

        <div className="ecp-env-page__body">
            {
                isLoadingList
                ? <SkeletonList rows={10}/>
                : identities.length === 0
                    ? <EmptyState icon="sitemap" title="No environments" message="Run a package to generate an environment."/>
                    : <DataTable
                        columns={columns}
                        rows={tableRows}
                        rowKey={(row:any) => row.key}
                        onRowClick={handleRowClick}
                        dense/>
            }
        </div>
    </div>
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
