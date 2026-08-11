import * as React from "react"
import { Icon } from "@i-components"

// Breadcrumb compacto de contexto da entidade. `items` é uma lista de strings.
const Breadcrumbs = ({ items = [] }:any) =>
    <nav className="ecp-breadcrumbs" aria-label="breadcrumb">
        {
            items.filter(Boolean).map((item:string, index:number, arr:string[]) =>
                <React.Fragment key={index}>
                    { index > 0 && <Icon name="right angle" className="ecp-breadcrumbs__sep"/> }
                    <span className={`ecp-breadcrumbs__item${index === arr.length - 1 ? " is-active" : ""}`}>{item}</span>
                </React.Fragment>)
        }
    </nav>

export default Breadcrumbs
