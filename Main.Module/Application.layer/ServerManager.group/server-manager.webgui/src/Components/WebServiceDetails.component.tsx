import * as React from "react"

import { Panel, ListRow } from "@i-components"

// Detalhe do web service selecionado: o nome do serviço e a lista de endpoints
// declarados no api template, com os parâmetros de cada um.
const WebServiceDetails = ({webService:{serviceName, apiTemplate}}:any) => {

    return <Panel title={serviceName} icon="plug">
                {
                    apiTemplate.endpoints.map(({summary, parameters}:any, key:any) =>
                    <ListRow
                        key   = {key}
                        title = {`${summary}(${
                            parameters
                            ? `{${parameters.map(({name}:any) => name).join(", ")}}`
                            : ""})`}/>)
                }
            </Panel>
}


export default WebServiceDetails
