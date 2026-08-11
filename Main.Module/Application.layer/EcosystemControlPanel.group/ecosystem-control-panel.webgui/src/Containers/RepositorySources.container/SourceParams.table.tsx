import * as React from "react"

import { DataTable, CopyableMonoText } from "@i-components"

// Parâmetros de uma fonte de repositório (path, repoOwner, fileId…).
// As colunas são dados puros -> DataTable. O valor pode ser um path longo,
// por isso passa por CopyableMonoText (truncamento central + copiar).
const SourceParamsTable = ({
    repositorySourceData
}) => {

    const rows = Object
        .keys(repositorySourceData)
        .filter((property) => property !== "repositoryNamespace" && property !== "sourceType")
        .map((property) => ({ property, value: repositorySourceData[property] }))

    return <DataTable
        dense
        className="ecp-source-params"
        rowKey={(row:any) => row.property}
        emptyMessage="no parameters"
        columns={[
            { key: "property", header: "Parameter", width: "38%" },
            {
                key: "value",
                header: "Value",
                render: (row:any) =>
                    <CopyableMonoText value={String(row.value ?? "")} maxChars={40}/>
            }
        ]}
        rows={rows}/>
}

export default SourceParamsTable
