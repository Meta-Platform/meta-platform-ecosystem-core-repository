import * as React from "react"
import { Breadcrumb } from "semantic-ui-react"

// Breadcrumb compacto de contexto da entidade. `items` é uma lista de strings.
const Breadcrumbs = ({ items = [] }:any) =>
    <Breadcrumb size="small" style={{ marginBottom: "8px", color: "var(--mp-muted)" }}>
        {
            items.filter(Boolean).map((item:string, index:number, arr:string[]) =>
                <React.Fragment key={index}>
                    { index > 0 && <Breadcrumb.Divider icon="right angle"/> }
                    <Breadcrumb.Section active={index === arr.length - 1}>{item}</Breadcrumb.Section>
                </React.Fragment>)
        }
    </Breadcrumb>

export default Breadcrumbs
