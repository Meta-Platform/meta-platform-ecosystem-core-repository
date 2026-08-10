import * as React                       from "react"
import ReactDOM                         from "react-dom/client"
import { Provider }                     from "react-redux"
import { combineReducers, createStore } from "redux"

import "@i-components/styles/index.css"
import "./Styles/server-manager.css"

import { applySavedTheme } from "@i-components/theme"

import PagesMapper from "./Mappers/Pages.mapper"
//@ts-ignore
import ROUTES_CONFIG from "./routes.config.json"

import AppContainer             from "./Containers/App.container"
import AppManagerReducer        from "./Reducers/AppManager.reducer"
import HTTPServerManagerReducer from "./Reducers/HTTPServerManager.reducer"
import ProcessManagerReducer    from "./Reducers/ProcessManager.reducer"

const reducer = combineReducers({
	AppManager        : AppManagerReducer,
	HTTPServerManager : HTTPServerManagerReducer,
	ProcessManager    : ProcessManagerReducer
})

const store = createStore(reducer)

// Antes do render: evita o "flash" do tema base antes do tema salvo entrar.
applySavedTheme()

const root = ReactDOM.createRoot(document.getElementById("gui"))

root.render(<Provider store={store}>
		<AppContainer
			routesConfig = {ROUTES_CONFIG}
			mapper       = {PagesMapper}/>
	</Provider>)