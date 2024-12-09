import * as React from "react"
import { useState, useEffect } from "react"

import {
    Table,
    Input,
    Loader,
    Segment
} from "semantic-ui-react"

import GetAPI from "../Utils/GetAPI"



const SourcesContainer = ({ serverManagerInformation }:any) => {

    const [ sourceList, setSourceList ] = useState<any[]>([])
    const [ isLoading, setIsLoading ] = useState(true)


    const _GetSourcesAPI = () => 
        GetAPI({ 
            apiName:"Sources",  
            serverManagerInformation 
        })
    
    useEffect(() => {
        fetchSourceList()
    }, [])
    
    const fetchSourceList = async () => {
        try {
            const api = _GetSourcesAPI()
            const response = await api.ListSources()
            const sourceList = response.data
            setSourceList(sourceList)
            setIsLoading(false)

        }catch(e){
            console.log(e)
        }
    }


    return <Segment style={{margin:"1em"}}>
                {
                    isLoading 
                    ? <Loader active style={{margin: "50px"}}/>
                    :<Table celled striped>
                        <Table.Header>
                            <Table.Row>
                                <Table.HeaderCell>repositoryNamespace</Table.HeaderCell>
                                <Table.HeaderCell>sourceType</Table.HeaderCell>
                                <Table.HeaderCell>repositoryName</Table.HeaderCell>
                                <Table.HeaderCell>repositoryOwner</Table.HeaderCell>
                                <Table.HeaderCell>path</Table.HeaderCell>
                                <Table.HeaderCell>fileId</Table.HeaderCell>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {
                                sourceList.map((repo: any, key:number) =>
                                    <Table.Row key={key}>
                                        {
                                            ["repositoryNamespace", "sourceType", "repositoryName", "repositoryOwner", "path", "fileId"]
                                                .map((property, key2) => <Table.Cell key={key2}>{repo[property]}</Table.Cell>)
                                        }
                                    </Table.Row>)
                            }
                        </Table.Body>
                    </Table>
                }
            </Segment>
}

export default SourcesContainer