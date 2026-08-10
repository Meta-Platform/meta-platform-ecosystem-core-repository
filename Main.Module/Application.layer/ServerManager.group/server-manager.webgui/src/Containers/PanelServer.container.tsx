import React                 from "react"
import {useEffect, useState} from "react"

import { Tabs, Panel, ListRow, Badge } from "@i-components"

const getPaneByKey = (panes:Array<any>, key:string) =>
	panes.find(({menuItem}) => menuItem === key)

// Verbo do endpoint → modificador de classe local. O tom sai dos tokens
// --mp-* (ver Styles/server-manager.css); nenhuma cor literal aqui.
const GetMethodModifier = (method:string) => {
	switch(method){
		case "GET":
			return "get"
		case "POST":
			return "post"
		case "PUT":
			return "put"
		case "WS":
			return "ws"
		case "DELETE":
			return "delete"
		default:
			return "none"
	}
}

const PanelServerContainer = ({
    status,
    queryParams,
    addQueryParam
}:any) =>{

    const [serverNameSelected, setServerNameSelected] = useState<string>()

    useEffect(() => {
		if(serverNameSelected){
            addQueryParam("server", serverNameSelected)
		}
	}, [serverNameSelected])

    const panes =
        status
        ? status.map(({name, port, listServices}:any, key:any) => ({
                menuItem: name + ":" + port,
                render: () =>
                        <div className="srv-card-grid">
                            {
                                listServices
                                .map(({
                                    serviceName,
                                    type,
                                    path,
                                    apiTemplate,
                                    summariesNotFound
                                }:any, key:number) =>
                                    <Panel
                                        key       = {key}
                                        className = "srv-card"
                                        title     = {
                                            type.replace("Web", "")
                                            .replace("APIEndpoints", "API Endpoints")
                                            .replace("StaticEndpoints", "Static Endpoints")
                                        }>
                                        { serviceName &&
                                            <div className="srv-card__service">{serviceName.replace("Web", "")}</div> }
                                        <div className="srv-card__path">{path}</div>
                                        {
                                            apiTemplate
                                            && apiTemplate.endpoints.map(({summary, path, method, parameters}:any, key:any) => {

                                                const missing = summariesNotFound.indexOf(summary) > -1

                                                const label = `${summary}(${
                                                    parameters
                                                    ? `{${parameters.map(({name}:any) => name).join(", ")}}`
                                                    : ""})`

                                                return <ListRow
                                                    key       = {key}
                                                    className = {missing ? "srv-endpoint--missing" : ""}
                                                    title     = {
                                                        missing
                                                        ? <span className="srv-endpoint__title--missing" title="sumário não encontrado no controller">{label}</span>
                                                        : label
                                                    }
                                                    meta      = {
                                                        <>
                                                            <Badge className={`srv-method srv-method--${GetMethodModifier(method)}`}>
                                                                {method || "NONE"}
                                                            </Badge>
                                                            {path}
                                                        </>
                                                    }/>
                                            })
                                        }
                                    </Panel>)
                            }
                        </div>
            }))
        : []

    useEffect(() => {
        if(!queryParams.server && panes && panes.length > 0)
            setServerNameSelected(panes[0].menuItem)
    }, [queryParams.server, panes])

    const activeKey = queryParams.server || serverNameSelected
    const activePane = getPaneByKey(panes, activeKey)

    return <>
                <Tabs
                    tabs      = {panes.map(({menuItem}:any) => ({ key: menuItem, label: menuItem }))}
                    activeKey = {activeKey}
                    onChange  = {(key:string) => setServerNameSelected(key)}/>
                <div className="srv-page__body">
                    { activePane && activePane.render() }
                </div>
            </>
}

export default PanelServerContainer
