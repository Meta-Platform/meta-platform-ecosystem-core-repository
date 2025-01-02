import * as React from "react"

import {
    TableHeaderCell,
    Table,
    TableRow,
    TableHeader,
    TableBody,
    TableCell
} from "semantic-ui-react"


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


export default SourceParamsTable