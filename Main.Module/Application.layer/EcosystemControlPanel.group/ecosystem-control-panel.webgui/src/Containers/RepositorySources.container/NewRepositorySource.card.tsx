import * as React from "react"
import { useState } from "react"

import {
    Button,
    ButtonGroup,
    ConfirmDialog,
    FormField,
    Panel,
    TextInput
} from "@i-components"

const ConfirmModal = ({
    repositoryNamespace,
    onGoBack,
    onConfirm
}) =>
    <ConfirmDialog
        open={true}
        title="Creating new repository namespace"
        confirmLabel="confirm"
        cancelLabel="go back"
        onCancel={() => onGoBack()}
        onConfirm={() => onConfirm()}
        message={<>Are you sure you want to create the <strong>{repositoryNamespace}</strong> namespace?</>}/>

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

    return <Panel title="new repository" icon="plus" className="ecp-new-repo-card">
                <FormField label="repository namespace" htmlFor="ecp-new-repo-namespace">
                    <TextInput
                        id="ecp-new-repo-namespace"
                        placeholder="repository namespace"
                        onChange={({target:{value}}) => setRepositoryNamespace(value)}/>
                </FormField>
                <ButtonGroup className="ecp-new-repo-card__actions">
                    <Button onClick={onCancel}>cancel</Button>
                    <Button
                        variant="primary"
                        disabled={!repositoryNamespace}
                        onClick={handleCreateNewRepository}>add</Button>
                </ButtonGroup>
                {
                    showModalConfirm
                    && <ConfirmModal
                            repositoryNamespace={repositoryNamespace}
                            onGoBack={() => setShowModalConfirm(false)}
                            onConfirm={handleModalConfirm}/>
                }
        </Panel>
}

export default NewRepositorySourceCard
