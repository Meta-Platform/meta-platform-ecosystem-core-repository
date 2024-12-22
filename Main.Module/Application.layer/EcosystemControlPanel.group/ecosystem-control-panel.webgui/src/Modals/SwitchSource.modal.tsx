import * as React from "react"

import {
    Modal,
    List,
    ListItem,
    ListHeader,
    ListDescription
} from "semantic-ui-react"

type ModalProps = {
    sourceList        : any[]
    open              : boolean
    onClose           : Function
}

import SourceParamsTable from "../Containers/Sources.container/SourceParams.table"

const SourceTypeListItem = ({
    repositorySourceData
}) => {
    return <ListItem style={{padding:"15px"}} >
                <ListDescription>source type</ListDescription>
                <ListHeader>{repositorySourceData.sourceType}</ListHeader>
                    <SourceParamsTable repositorySourceData={repositorySourceData}/>          
            </ListItem>
}

const SwitchSourceModal = ({ sourceList, open, onClose }:ModalProps) =>{

    return <Modal 
                open={open} 
                closeIcon 
                size="tiny"
                onClose={() => onClose()}>
                <Modal.Header>switch source</Modal.Header>
                <Modal.Content>
                    <List divided style={{"backgroundColor":"floralwhite"}}>
                        {
                            sourceList
                                .map((repo) => <SourceTypeListItem repositorySourceData={repo}/>)
                        }
                        </List>
                </Modal.Content>
            </Modal>
}
    
  

  export default SwitchSourceModal