import * as React from "react"

import {
    ListItem,
    ListHeader,
    ListContent,
    List
 } from "semantic-ui-react"

const boxStyle = {
    marginLeft: "10px",
    color: "rgb(98 98 98)",
    backgroundColor: "#e8e8e8",
    padding: "10px",
    wordBreak: "break-all" as const
}

const listStyle = {
    margin: "0px 15px 0px 15px",
    backgroundColor: "#e8e8e8",
    color: "rgb(98 98 98)",
    padding: "10px"
}

// Renderiza qualquer valor com segurança. Objetos/arrays são percorridos
// recursivamente — nunca renderiza um objeto cru como filho React (o que
// quebrava o detalhe da task com campos aninhados como executionData).
const RenderValue = ({ value }:any) => {

    if(value === null || value === undefined)
        return <span style={{ marginLeft: "10px", color: "var(--mp-muted-2)" }}>—</span>

    if(typeof value === "string" || typeof value === "number" || typeof value === "boolean")
        return <div style={boxStyle}>{String(value)}</div>

    if(Array.isArray(value)){
        if(value.length === 0)
            return <div style={boxStyle}>[]</div>
        return <List divided relaxed style={listStyle}>
            {
                value.map((item:any, index:number) =>
                    <ListItem key={index}>
                        <ListContent>
                            <RenderValue value={item}/>
                        </ListContent>
                    </ListItem>)
            }
        </List>
    }

    if(typeof value === "object")
        return <List divided relaxed style={listStyle}>
            {
                Object.keys(value).map((property:string, index:number) =>
                    <ListItem key={index}>
                        <ListContent>
                            <ListHeader style={{ color: "rgb(98 98 98)" }}>{property}</ListHeader>
                            <RenderValue value={value[property]}/>
                        </ListContent>
                    </ListItem>)
            }
        </List>

    return <div style={boxStyle}>{String(value)}</div>
}

export default RenderValue
