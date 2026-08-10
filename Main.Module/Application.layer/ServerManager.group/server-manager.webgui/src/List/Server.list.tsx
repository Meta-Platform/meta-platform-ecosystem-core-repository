
import * as React from "react"

import { ListRow } from "@i-components"

type ListProps =
{
	list               : Array<any>
	selected           : any
	onSelectHTTPServer : Function
	onSelectService    : Function
}

// Servidores HTTP em execução e, pendurados em cada um, os serviços que ele
// publica. Dois níveis sempre abertos — o recuo do filho é do aplicativo
// (.srv-tree__child), a linha em si é a do kit.
const ServerList = ({list, selected, onSelectHTTPServer, onSelectService}:ListProps) => {
	return <div className="srv-tree">
				{
					list.map(({name, listServices, port}:any, key:number) =>
					<div key={key}>
						<ListRow
							icon    = "globe"
							title   = {name}
							meta    = {port}
							onClick = {() => onSelectHTTPServer(name)}/>
						{
							listServices.map(({apiTemplate, path, staticDir}:any, key:any) =>
							<div key={key} title={staticDir}>
								<ListRow
									className = "srv-tree__child"
									icon      = "folder"
									title     = {apiTemplate ? apiTemplate.name : path}
									selected  = {apiTemplate && selected.webservice === apiTemplate.name && selected.webserver === name}
									onClick   = {() => onSelectService({webservice:apiTemplate && apiTemplate.name, webserver:name})}/>
							</div>)
						}
					</div>)
				}
			</div>
}


export default ServerList
