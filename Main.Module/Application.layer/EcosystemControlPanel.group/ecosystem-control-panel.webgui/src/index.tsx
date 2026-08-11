import * as React                       from "react"
import ReactDOM                         from "react-dom/client"
import { Provider }                     from "react-redux"
import { combineReducers, createStore } from "redux"

import "@i-components/styles/index.css"
import "./Styles/control-panel.css"

import { applySavedTheme } from "@i-components"

// aplica o tema salvo (dark/gray/blue/cyberpunk) antes de renderizar
applySavedTheme()

import PagesMapper from "./Mappers/Pages.mapper"

//@ts-ignore
import ROUTES_CONFIG from "./routes.config.json"

import QueryParamsReducer    from "./Reducers/QueryParams.reducer"

import AppContainer             from "./Containers/App.container"
import AppManagerReducer        from "./Reducers/AppManager.reducer"
import HTTPServerManagerReducer from "./Reducers/HTTPServerManager.reducer"
import ProcessManagerReducer    from "./Reducers/ProcessManager.reducer"

const reducer = combineReducers({
	AppManager        : AppManagerReducer,
	HTTPServerManager : HTTPServerManagerReducer,
	ProcessManager    : ProcessManagerReducer,
	QueryParams       :  QueryParamsReducer
})

const store = createStore(reducer)

const root = ReactDOM.createRoot(document.getElementById("gui"))

root.render(<Provider store={store}>
	{/*//TODO trocar para App.container */}
	<AppContainer
		routesConfig = {ROUTES_CONFIG}
		mapper = {PagesMapper}/>
</Provider>)
