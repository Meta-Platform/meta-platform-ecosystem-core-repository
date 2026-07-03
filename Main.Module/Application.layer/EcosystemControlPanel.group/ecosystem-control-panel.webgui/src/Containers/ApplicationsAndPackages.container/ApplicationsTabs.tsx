import * as React from "react"

import {
    Tab, 
    Loader,
    Dimmer,
    TabPane,
    Header,
    CardGroup
} from "semantic-ui-react"

import ItemApplication from "../../Components/ItemApplication"

const GroupDataListByRepositoryNamespace = (applicationList) => {
    return applicationList
    .reduce((acc, applicationData) => {

        if(!acc[applicationData.repositoryNamespace]){
            acc[applicationData.repositoryNamespace] = []
        }

        acc[applicationData.repositoryNamespace].push(applicationData)

        return acc
    }, {})
}

const ApplicationDataCardGroup = ({applicationList, serverManagerInformation}) => {

    const applicationDataGrouped = GroupDataListByRepositoryNamespace(applicationList)

    return <>
        {
            Object.keys(applicationDataGrouped)
            .map((repositoryNamespace) => <>
                <Header dividing>{repositoryNamespace}</Header>
                <CardGroup>
                    {
                        applicationDataGrouped[repositoryNamespace]
                        .map((applicationData:any, key) => 
                            <ItemApplication key={key} applicationData={applicationData} serverManagerInformation={serverManagerInformation}/>)
                    }
                </CardGroup> 
            </>)

        }
        
    </> 
}

const ApplicationsTabs = ({
    isLoading,
    installedApplicationList,
    serverManagerInformation
}) => {

    const applicationListByRepo =
        installedApplicationList
        .reduce((acc, applicationData) => {

            if(!acc[applicationData.repositoryNamespace]){
                acc[applicationData.repositoryNamespace] = []
            }

            acc[applicationData.repositoryNamespace].push(applicationData)

            return acc
        }, {})

    const panes = [
        {
            menuItem: 'standard aplication',
            render: () => <TabPane attached={false} style={{"backgroundColor": "mistyrose"}}> 
                                <ApplicationDataCardGroup applicationList={installedApplicationList
                                        .filter(({appType}) => appType === "APP")}
                                    serverManagerInformation={serverManagerInformation} />
                        </TabPane>,
        },
        {
            menuItem: 'command line application',
            render: () => <TabPane attached={false} style={{"backgroundColor": "mintcream"}}>
                                <ApplicationDataCardGroup applicationList={installedApplicationList
                                        .filter(({appType}) => appType === "CLI")}
                                    serverManagerInformation={serverManagerInformation} />
                        </TabPane>,
        }
    ]

    return isLoading ? <Dimmer active><Loader/></Dimmer>: <Tab menu={{ secondary: true, pointing: true }} panes={panes} />
}

export default ApplicationsTabs
