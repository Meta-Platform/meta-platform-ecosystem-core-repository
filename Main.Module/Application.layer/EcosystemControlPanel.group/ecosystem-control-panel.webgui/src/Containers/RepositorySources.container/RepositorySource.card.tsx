import * as React from "react"
import { useState } from "react"

import {
    Button,
    ButtonGroup,
    Panel,
    Spinner,
    Tabs
} from "@i-components"

import { GetAPI } from "@i-components/net"

const RepositorySourceCard = ({
    repositoryNamespace,
    serverManagerInformation,
    activeSourceList,
    onOpenSwitchSource
}) => {

    const [ isUpdating, setIsUpdating ] = useState(false)
    // O `Tabs` do kit é só a barra: o estado da aba ativa é da tela.
    const [ activeTabKey, setActiveTabKey ] = useState<string>("LOCAL_FS")

    const activeSourceData = activeSourceList
        .find((activeSourceData) => activeSourceData.repositoryNamespace === repositoryNamespace)

    const _GetSourcesAPI = () =>
        GetAPI({
            apiName:"Sources",
            serverManagerInformation
        })

    const UpdateRepository = async () => {
        try {
            setIsUpdating(true)
            const api = _GetSourcesAPI()
            await api.UpdateRepository({repositoryNamespace})
            setIsUpdating(false)
        }catch(e){
            console.log(e)
            setIsUpdating(false)
        }
    }

    const handleUpdateRepository = () => UpdateRepository()

    const tabs = [ { key: "LOCAL_FS", label: "LOCAL_FS" } ]

    return <Panel title={repositoryNamespace} icon="cubes" className="ecp-repo-source-card">
        {
            activeSourceData
            ? <>
                <Tabs tabs={tabs} activeKey={activeTabKey} onChange={setActiveTabKey}/>
                <div className="ecp-repo-source-card__pane">dfgdfgsdfg</div>
                <ButtonGroup>
                    <Button onClick={() => onOpenSwitchSource(repositoryNamespace)}>switch source</Button>
                    <Button variant="primary" loading={isUpdating} onClick={handleUpdateRepository}>update repository</Button>
                </ButtonGroup>
            </>
            : <Spinner/>
        }
    </Panel>
}

export default RepositorySourceCard
