import * as React from "react"
import { useState, useEffect } from "react"

import {
    Loader,
    Segment,
    Menu,
    MenuMenu,
    MenuItem,
    Button,
    ListItem,
    TableHeaderCell,
    Table,
    ListHeader,
    List,
    Icon,
    TableRow,
    TableHeader,
    TableBody,
    TableCell,
    ListDescription
} from "semantic-ui-react"

import GetAPI from "../Utils/GetAPI"

const GroupSources = (sourceList) => {

    return sourceList.reduce((acc, source) => {

        if(!acc[source.repositoryNamespace]){
            acc[source.repositoryNamespace] = []
        }

        acc[source.repositoryNamespace].push(source)

        return acc
    }, {})
}

const SourceParamsTable = ({
    repositorySourceData
}) => {

    return <Table basic='very' celled collapsing style={{"backgroundColor":"antiquewhite", "padding":"10px"}}>
                <TableHeader>
                    <TableRow>
                        <TableHeaderCell>Parameter</TableHeaderCell>
                        <TableHeaderCell>value</TableHeaderCell>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {
                        Object
                        .keys(repositorySourceData)
                        .filter((property) => property !== "repositoryNamespace" && property !== "sourceType")
                        .map((property) => <TableRow>
                                                <TableCell>{property}</TableCell>
                                                <TableCell><strong>{repositorySourceData[property]}</strong></TableCell>
                                                {/*<TableCell style={{"padding":"5px"}}><Button size="mini" primary>edit</Button></TableCell>*/}
                                            </TableRow>)
                    }
                </TableBody>
            </Table>

}

const SourceTypeListItem = ({
    repositorySourceData
}) => {
    return <ListItem style={{padding:"15px"}} >
                <ListDescription>source type</ListDescription>
                <ListHeader>{repositorySourceData.sourceType}</ListHeader>
                    <SourceParamsTable repositorySourceData={repositorySourceData}/>          
            </ListItem>
}

const RepositoryNamespacePanel = ({
    repositoryNamespace,
    groupedSources,
    activeSourceList
}) => {

    const activeSourceData = activeSourceList
        .find((activeSourceData) => activeSourceData.repositoryNamespace === repositoryNamespace)

    return <Segment style={{marginRight:"15px", "backgroundColor":"lavender"}} >
        <strong style={{"fontSize": "large"}}>{repositoryNamespace}</strong>


        {
            activeSourceData
             && <SourceParamsTable repositorySourceData={activeSourceData.sourceData}/>          
        }

        {/*<List divided style={{"backgroundColor":"floralwhite"}}>
        {
            groupedSources[repositoryNamespace]
                .map((repo) => <SourceTypeListItem repositorySourceData={repo}/>)
        }
        </List>*/}
    </Segment>
}

const SourcesContainer = ({ serverManagerInformation }:any) => {

    const [ sourceList, setSourceList ] = useState<any[]>([])
    const [ activeSourceList, setActiveSourceList ] = useState<any[]>([])
    const [ isLoading, setIsLoading ] = useState(true)

    const [ groupedSources, setGroupedSources] = useState({})

    const _GetSourcesAPI = () => 
        GetAPI({ 
            apiName:"Sources",  
            serverManagerInformation 
        })
    
    useEffect(() => {
        fetchSourceList()
        fetchActiveSourceList()
    }, [])
    
    const fetchSourceList = async () => {
        try {
            const api = _GetSourcesAPI()
            const response = await api.ListSources()
            const sourceList = response.data
            setSourceList(sourceList)
            setGroupedSources(GroupSources(sourceList))
            setIsLoading(false)

        }catch(e){
            console.log(e)
        }
    }

    const fetchActiveSourceList = async () => {
        try {
            const api = _GetSourcesAPI()
            const response = await api.ListActiveSources()
            const activeSourceList = response.data
            setActiveSourceList(activeSourceList)
        }catch(e){
            console.log(e)
        }
    }
    
    return <>
                <Menu style={{margin:"1em", "backgroundColor": "honeydew"}} >
                    <MenuMenu position='right'>
                        <MenuItem>
                            <Button icon primary>
                                add new repository namespace 
                            </Button>
                        </MenuItem>
                    </MenuMenu>
                </Menu>
                <Segment style={{margin:"1em", "backgroundColor": "honeydew"}}>
                
                    {
                        isLoading 
                        ? <Loader active style={{margin: "50px"}}/>
                        :<div style={{ overflow: 'auto', height:"82vh" }}>
                            {
                                Object.keys(groupedSources)
                                .map((repositoryNamespace) =>
                                    <RepositoryNamespacePanel
                                        activeSourceList={activeSourceList}
                                        repositoryNamespace={repositoryNamespace}
                                        groupedSources={groupedSources}/>)
                            }
                        </div>
                    }
                </Segment>
            </>
}

export default SourcesContainer