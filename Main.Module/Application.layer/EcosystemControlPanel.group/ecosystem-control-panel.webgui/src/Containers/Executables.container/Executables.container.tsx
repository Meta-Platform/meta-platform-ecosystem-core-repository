import * as React from "react"
import { useState, useEffect } from "react"

import { Button, Card, Checkbox, Header, Icon, Input, Label, Loader, Segment } from "semantic-ui-react"

import GetAPI from "../../Utils/GetAPI"
import ListSkeleton from "../../Components/Skeleton"
import ExecutableInformation from "./ExecutableInformation"

const GROUPS = [
    { type: "application", label: "Application / Daemon", icon: "desktop" },
    { type: "cli",         label: "Command Line",        icon: "terminal" }
]

const ExecutablesContainer = ({ serverManagerInformation, selectedExecutableName, onSelectExecutable, onClearExecutable }:any) => {

    const [ executableList, setExecutableList ]               = useState<any[]>([])
    const [ isListLoading, setIsListLoading ]                 = useState(true)
    const [ executableInformation, setExecutableInformation ] = useState<any>()
    const [ isLoading, setIsLoading ]                         = useState(false)
    const [ showDebug, setShowDebug ]                         = useState(false)
    const [ filterValue, setFilterValue ]                    = useState<string>("")

    const _GetExecutablesAPI = () =>
        GetAPI({ apiName: "Executables", serverManagerInformation })

    useEffect(() => { fetchExecutableList() }, [])

    useEffect(() => {
        if(selectedExecutableName) fetchExecutableInformation()
        else setExecutableInformation(undefined)
    }, [selectedExecutableName])

    const fetchExecutableList = async () => {
        try { setExecutableList((await _GetExecutablesAPI().ListExecutables()).data) }
        catch(e){ console.log(e) } finally { setIsListLoading(false) }
    }

    const fetchExecutableInformation = async () => {
        try {
            setIsLoading(true); setExecutableInformation(undefined)
            const response = await _GetExecutablesAPI().GetExecutableInformation({ executableName: selectedExecutableName })
            setExecutableInformation(response.data)
        } catch(e){ console.log(e) } finally { setIsLoading(false) }
    }

    // ---- DETALHE ----
    if(selectedExecutableName)
        return <Segment style={{ margin: "15px" }}>
            <Button size="small" basic icon labelPosition="left" onClick={onClearExecutable} style={{ marginBottom: "8px" }}>
                <Icon name="arrow left"/> executables
            </Button>
            {
                isLoading
                ? <Loader active style={{ margin: "50px" }}/>
                : <ExecutableInformation executableInformation={executableInformation} serverManagerInformation={serverManagerInformation}/>
            }
        </Segment>

    // ---- GRADE DE CARDS ----
    const visible = executableList.filter((e:any) =>
        (showDebug || !e.isDebug) &&
        (!filterValue || `${e.executableName} ${e.type}`.toLowerCase().includes(filterValue.toLowerCase())))

    return <Segment style={{ margin: "15px" }}>
        <Header>
            <Icon name="terminal"/>
            <Header.Content>
                Executables
                <Header.Subheader>executáveis instalados em /executables</Header.Subheader>
            </Header.Content>
        </Header>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px", flexWrap: "wrap" }}>
            <Label size="large"><Icon name="terminal"/> {executableList.filter((e:any) => !e.isDebug).length} executables</Label>
            <Checkbox toggle label="mostrar -dbg" checked={showDebug} onChange={() => setShowDebug(!showDebug)}/>
            <Input icon="search" size="small" placeholder="filtrar..." value={filterValue}
                onChange={(e, { value }) => setFilterValue(value)} style={{ marginLeft: "auto" }}/>
        </div>

        {
            isListLoading
            ? <ListSkeleton lines={8}/>
            : GROUPS.map((group:any) => {
                const items = visible
                    .filter((e:any) => e.type === group.type)
                    .sort((a:any, b:any) => a.executableName.localeCompare(b.executableName))
                if(items.length === 0) return null
                return <div key={group.type} style={{ marginBottom: "16px" }}>
                    <div style={{ color: "#8a9099", fontSize: ".8em", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".03em", marginBottom: "6px" }}>
                        <Icon name={group.icon}/> {group.label} <Label circular size="mini">{items.length}</Label>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "10px" }}>
                        {
                            items.map((executable:any, key:number) =>
                                <Card key={key} fluid onClick={() => onSelectExecutable(executable.executableName)} style={{ margin: 0, cursor: "pointer" }}>
                                    <Card.Content style={{ padding: "10px 12px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                            <Icon name={group.icon} style={{ color: "#7b8794" }}/>
                                            <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{executable.executableName}</span>
                                            { executable.isDebug && <Label size="mini" color="grey">dbg</Label> }
                                        </div>
                                    </Card.Content>
                                </Card>)
                        }
                    </div>
                </div>
            })
        }
        { !isListLoading && visible.length === 0 && <div style={{ color: "#bbb", padding: "16px" }}>nenhum executável corresponde ao filtro</div> }
    </Segment>
}

export default ExecutablesContainer
