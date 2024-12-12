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

const ApplicationDataCardGroup = ({applicationList}) => {

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
                            <ItemApplication key={key} applicationData={applicationData}/>)
                    }
                </CardGroup> 
            </>)

        }
        
    </> 
}

const ApplicationsList = ({
    isLoading,
    installedApplicationList
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
                                        .filter(({appType}) => appType === "APP")} />
                        </TabPane>,
        },
        {
            menuItem: 'command line application',
            render: () => <TabPane attached={false} style={{"backgroundColor": "mintcream"}}>
                                <ApplicationDataCardGroup applicationList={installedApplicationList
                                        .filter(({appType}) => appType === "CLI")} />
                        </TabPane>,
        }
    ]

    return isLoading ? <Dimmer active><Loader/></Dimmer>: <Tab menu={{ secondary: true, pointing: true }} panes={panes} />
}

export default ApplicationsList