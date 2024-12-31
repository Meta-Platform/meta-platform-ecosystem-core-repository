import * as React from "react"

import { 
    ListItem,
    ListHeader,
    ListDescription,
    ListContent,
    List
 } from "semantic-ui-react"


const RenderValue = ({value}) => {

    if(!value) return "UNDEFINED"

    if(typeof value === "string")
        return <div style={{ marginLeft:"10px", color:"rgb(98 98 98)", backgroundColor: "#e8e8e8", padding:"10px" }}>{value}</div>

    if(Array.isArray(value))
        return  <List divided relaxed style={{ margin:"0px 15px 0px 15px", backgroundColor: "#e8e8e8", color:"rgb(98 98 98)", padding:"10px" }}>
                    {
                        Object.keys(value)
                        .map((property) => 
                            <ListItem>
                                <ListContent>{value[property]}</ListContent>
                            </ListItem>)
                    }
                </List>

    if(typeof value === "object")
        return  <List divided relaxed style={{ margin:"0px 15px 0px 15px", backgroundColor: "#e8e8e8", color:"rgb(98 98 98)", padding:"10px" }}>
                    {
                        Object.keys(value)
                        .map((property) => 
                            <ListItem>
                                <ListContent>
                                    <ListHeader style={{ color:"rgb(98 98 98)" }}>{property}</ListHeader>
                                    <ListDescription style={{ color:"rgb(98 98 98)" }}>{value[property]}</ListDescription>
                                </ListContent>
                            </ListItem>)
                    }
                </List>

    return <div style={{ marginLeft:"10px", color:"rgb(98 98 98)", backgroundColor: "#e8e8e8", padding:"10px" }}>{value}</div>

}

export default RenderValue