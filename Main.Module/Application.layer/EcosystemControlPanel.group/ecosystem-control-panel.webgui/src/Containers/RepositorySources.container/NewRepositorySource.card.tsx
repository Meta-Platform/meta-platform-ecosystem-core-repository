import * as React from "react"
import { useState, useEffect } from "react"

import {
    Segment,
    Button,
    ButtonGroup,
    Card,
    Form,
    FormField,
    Modal,
    ModalHeader,
    ModalContent,
    ModalActions
} from "semantic-ui-react"

const ConfirmModal = ({
    repositoryNamespace,
    onGoBack,
    onConfirm
}) => {

    return  <Modal size="mini"open={true} onClose={() => {}}>
                <ModalHeader>Creating new repository namespace</ModalHeader>
                <ModalContent>
                    <p>Are you sure you want to create the <strong>{repositoryNamespace}</strong> namespace?</p>
                </ModalContent>
                <ModalActions>
                    <Button onClick={() => onGoBack()}>
                        go back
                    </Button>
                    <Button color="orange" onClick={() => onConfirm()}>
                        confirm
                    </Button>
                </ModalActions>
            </Modal>
}

const NewRepositorySourceCard = ({
    onCancel,
    onCreateRepositoryNamespace
}) => {

    const [ repositoryNamespace, setRepositoryNamespace ] = useState<string>()

    const [ showModalConfirm, setShowModalConfirm ] = useState<boolean>()

    const handleCreateNewRepository = () => setShowModalConfirm(true)

    const handleModalConfirm = () => {
        onCreateRepositoryNamespace(repositoryNamespace)
    }

    return <Card style={{"width":"400px", "padding":"15px", "border":"2px solid blue"}}>
        <strong style={{"fontSize": "large", color:"write"}}>new repository</strong>
        <Segment style={{"backgroundColor": "blanchedalmond"}}>
            <Form>
                <FormField>
                    <label>repository namespace</label>
                    <input placeholder='repository namespace' onChange={({target:{value}}) => setRepositoryNamespace(value)}  />
                </FormField>
            </Form>
        </Segment>
        <ButtonGroup>
            <Button  onClick={onCancel}>cancel</Button>
            <Button color="orange" disabled={!repositoryNamespace} onClick={handleCreateNewRepository}>add</Button>
        </ButtonGroup>
       {
            showModalConfirm
            && <ConfirmModal 
                    repositoryNamespace={repositoryNamespace}
                    onGoBack={() => setShowModalConfirm(false)}
                    onConfirm={handleModalConfirm}/>
       }
    </Card>
}

export default NewRepositorySourceCard