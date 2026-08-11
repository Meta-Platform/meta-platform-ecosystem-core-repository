import * as React from "react"
import { useState } from "react"

import {
    Banner,
    Button,
    Dialog,
    FormField,
    SelectInput,
    TextInput
} from "@i-components"

const SOURCE_TYPE_OPTIONS = [
    { value: "LOCAL_FS",       label: "Local filesystem (LOCAL_FS)" },
    { value: "GITHUB_RELEASE", label: "GitHub release (GITHUB_RELEASE)" },
    { value: "GOOGLE_DRIVE",   label: "Google Drive (GOOGLE_DRIVE)" }
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

    return <Dialog
        open={true}
        size="md"
        icon="feed"
        title="Register new source"
        onClose={onCancel}
        actions={<>
            <Button onClick={onCancel} disabled={isRegistering}>cancel</Button>
            <Button
                variant="primary"
                icon="plus"
                disabled={!isValid()}
                loading={isRegistering}
                onClick={handleRegister}>register source</Button>
        </>}>
        <form className="ecp-register-source-form" onSubmit={(event) => event.preventDefault()}>
            <FormField label="repository namespace" htmlFor="ecp-register-source-namespace">
                <TextInput
                    id="ecp-register-source-namespace"
                    list="namespace-options"
                    placeholder="e.g. meta-platform-essential-repository"
                    value={repositoryNamespace}
                    onChange={({ target: { value } }) => setRepositoryNamespace(value)}/>
                <datalist id="namespace-options">
                    { namespaceOptions.map((ns:string, k:number) => <option key={k} value={ns}/>) }
                </datalist>
            </FormField>

            <FormField label="source type" htmlFor="ecp-register-source-type">
                <SelectInput
                    id="ecp-register-source-type"
                    options={SOURCE_TYPE_OPTIONS}
                    value={sourceType}
                    onChange={({ target: { value } }:any) => { setSourceType(value); setFields({}) }}/>
            </FormField>

            {
                sourceType === "LOCAL_FS" &&
                <FormField label="local path" htmlFor="ecp-register-source-path">
                    <TextInput
                        id="ecp-register-source-path"
                        placeholder="/path/to/the/repository"
                        value={fields.localPath || ""}
                        onChange={({ target: { value } }) => setField("localPath", value)}/>
                </FormField>
            }
            {
                sourceType === "GITHUB_RELEASE" && <>
                    <FormField label="repo owner" htmlFor="ecp-register-source-owner">
                        <TextInput
                            id="ecp-register-source-owner"
                            placeholder="GitHub user/owner"
                            value={fields.repoOwner || ""}
                            onChange={({ target: { value } }) => setField("repoOwner", value)}/>
                    </FormField>
                    <FormField label="repo name" htmlFor="ecp-register-source-name">
                        <TextInput
                            id="ecp-register-source-name"
                            placeholder="GitHub repository name"
                            value={fields.repoName || ""}
                            onChange={({ target: { value } }) => setField("repoName", value)}/>
                    </FormField>
                </>
            }
            {
                sourceType === "GOOGLE_DRIVE" &&
                <FormField label="file id" htmlFor="ecp-register-source-fileid">
                    <TextInput
                        id="ecp-register-source-fileid"
                        placeholder="Google Drive .tar.gz file id"
                        value={fields.fileId || ""}
                        onChange={({ target: { value } }) => setField("fileId", value)}/>
                </FormField>
            }
        </form>

        <Banner tone="info" icon="info circle" className="ecp-register-source-note">
            Registering a source only records it in <code>sources.json</code>. Installation is a separate step.
        </Banner>
    </Dialog>
}

export default RegisterSourceModal
