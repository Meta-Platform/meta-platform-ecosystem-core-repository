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
        <Modal.Header><Icon name="feed"/> Registrar nova fonte</Modal.Header>
        <Modal.Content>
            <Form>
                <Form.Field>
                    <label>repository namespace</label>
                    <input
                        list="namespace-options"
                        placeholder="ex.: meta-platform-essential-repository"
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
                        placeholder="/caminho/para/o/repositorio"
                        value={fields.localPath || ""}
                        onChange={(e, { value }) => setField("localPath", value)}/>
                }
                {
                    sourceType === "GITHUB_RELEASE" && <>
                        <Form.Input
                            label="repo owner"
                            placeholder="usuário/owner no GitHub"
                            value={fields.repoOwner || ""}
                            onChange={(e, { value }) => setField("repoOwner", value)}/>
                        <Form.Input
                            label="repo name"
                            placeholder="nome do repositório no GitHub"
                            value={fields.repoName || ""}
                            onChange={(e, { value }) => setField("repoName", value)}/>
                    </>
                }
                {
                    sourceType === "GOOGLE_DRIVE" &&
                    <Form.Input
                        label="file id"
                        placeholder="id do arquivo .tar.gz no Google Drive"
                        value={fields.fileId || ""}
                        onChange={(e, { value }) => setField("fileId", value)}/>
                }
            </Form>
            <Message info size="small">
                <Icon name="info circle"/>
                Registrar uma fonte apenas a cadastra em <code>sources.json</code>. A instalação é um passo separado.
            </Message>
        </Modal.Content>
        <Modal.Actions>
            <Button onClick={onCancel} disabled={isRegistering}>cancelar</Button>
            <Button color="blue" disabled={!isValid()} loading={isRegistering} onClick={handleRegister}>
                <Icon name="plus"/> registrar fonte
            </Button>
        </Modal.Actions>
    </Modal>
}

export default RegisterSourceModal
