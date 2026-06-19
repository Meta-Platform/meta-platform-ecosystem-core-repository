import * as React from "react"
import { Placeholder } from "semantic-ui-react"

// Skeleton de carregamento (melhor que spinner solto para listas/tabelas).
export const ListSkeleton = ({ lines = 6 }:any) =>
    <Placeholder fluid style={{ maxWidth: "100%" }}>
        {
            Array.from({ length: lines }).map((_, i) =>
                <Placeholder.Line key={i} length={i % 3 === 0 ? "full" : (i % 2 === 0 ? "long" : "medium")}/>)
        }
    </Placeholder>

export default ListSkeleton
