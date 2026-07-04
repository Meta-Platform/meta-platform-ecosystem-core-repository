import * as React from "react"
import { useState } from "react"

import {
    Button,
    Form,
    Icon,
    Modal,
    Message
} from "semantic-ui-react"

const SOURCE_TYPE_OPTIONS = [
    { key: "LOCAL_FS",       text: "Local filesystem (LOCAL_FS)",   value: "LOCAL_FS" },
    { key: "GITHUB_RELEASE", text: "GitHub release (GITHUB_RELEASE)", value: "GITHUB_RELEASE" },
    { key: "GOOGLE_DRIVE",   text: "Google Drive (GOOGLE_DRIVE)",   value: "GOOGLE_DRIVE" }
]

// Os campos variam conforme o tipo de fonte, espelhando o comando
// `repo register source` (LOCAL_FS=path, GITHUB_RELEASE=repoName/repoOwner,
// GOOGLE_DRIVE=fileId).
const RegisterSourceModal = ({
    namespaceOptions = [],
    defaultNamespace,
    onCancel,
    onRegister,
    isRegistering
}:any) => {

    const [ repositoryNamespace, setRepositoryNamespace ] = useState<string>(defaultNamespace || "")
    const [ sourceType, setSourceType ] = useState<string>("LOCAL_FS")
    const [ fields, setFields ] = useState<any>({})

    const setField = (key:string, value:string) => setFields({ ...fields, [key]: value })

    const isValid = () => {
        if(!repositoryNamespace || !sourceType) return false
        if(sourceType === "LOCAL_FS")       return !!fields.localPath
        if(sourceType === "GITHUB_RELEASE") return !!fields.repoName && !!fields.repoOwner
        if(sourceType === "GOOGLE_DRIVE")   return !!fields.fileId
        return false
    }

    const handleRegister = () =>
        onRegister({ repositoryNamespace, sourceType, ...fields })

    return <Modal size="small" open={true} onClose={onCancel}>
        <Modal.Header><Icon name="feed"/> Register new source</Modal.Header>
        <Modal.Content>
            <Form>
                <Form.Field>
                    <label>repository namespace</label>
                    <input
                        list="namespace-options"
                        placeholder="e.g. meta-platform-essential-repository"
                        value={repositoryNamespace}
                        onChange={({ target: { value } }) => setRepositoryNamespace(value)}/>
                    <datalist id="namespace-options">
                        { namespaceOptions.map((ns:string, k:number) => <option key={k} value={ns}/>) }
                    </datalist>
                </Form.Field>

                <Form.Select
                    label="source type"
                    options={SOURCE_TYPE_OPTIONS}
                    value={sourceType}
                    onChange={(e, { value }:any) => { setSourceType(value); setFields({}) }}/>

                {
                    sourceType === "LOCAL_FS" &&
                    <Form.Input
                        label="local path"
                        placeholder="/path/to/the/repository"
                        value={fields.localPath || ""}
                        onChange={(e, { value }) => setField("localPath", value)}/>
                }
                {
                    sourceType === "GITHUB_RELEASE" && <>
                        <Form.Input
                            label="repo owner"
                            placeholder="GitHub user/owner"
                            value={fields.repoOwner || ""}
                            onChange={(e, { value }) => setField("repoOwner", value)}/>
                        <Form.Input
                            label="repo name"
                            placeholder="GitHub repository name"
                            value={fields.repoName || ""}
                            onChange={(e, { value }) => setField("repoName", value)}/>
                    </>
                }
                {
                    sourceType === "GOOGLE_DRIVE" &&
                    <Form.Input
                        label="file id"
                        placeholder="Google Drive .tar.gz file id"
                        value={fields.fileId || ""}
                        onChange={(e, { value }) => setField("fileId", value)}/>
                }
            </Form>
            <Message info size="small">
                <Icon name="info circle"/>
                Registering a source only records it in <code>sources.json</code>. Installation is a separate step.
            </Message>
        </Modal.Content>
        <Modal.Actions>
            <Button onClick={onCancel} disabled={isRegistering}>cancel</Button>
            <Button color="blue" disabled={!isValid()} loading={isRegistering} onClick={handleRegister}>
                <Icon name="plus"/> register source
            </Button>
        </Modal.Actions>
    </Modal>
}

export default RegisterSourceModal
