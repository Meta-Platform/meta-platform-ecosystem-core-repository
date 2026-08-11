import * as React from "react"
import {useState, useEffect} from "react"

import { Button, Dialog, FormField, TextInput } from "@i-components"


type ModalProps = {
    ecosystemdataPath : string
    open              : boolean
    onClose           : Function
    onChangePath      : (path:string) => void
}

const EcosystemDataPathModal = ({ ecosystemdataPath, open, onClose, onChangePath }:ModalProps) =>{

    const [ pathValue, setPathValue ] = useState<string>(ecosystemdataPath)
    const [ isSaving, setIsSaving ]   = useState<boolean>(false)

    // Sempre que o modal abre (ou o path atual muda), sincroniza o input.
    useEffect(() => {
        if(open) setPathValue(ecosystemdataPath)
    }, [open, ecosystemdataPath])

    const hasChanged = pathValue !== ecosystemdataPath && pathValue?.trim() !== ""

    const handleChange = async () => {
        setIsSaving(true)
        await onChangePath(pathValue.trim())
    }

    return <Dialog
                open={open}
                size="sm"
                icon="folder open"
                title="ecosystem data path"
                onClose={() => onClose()}
                actions={<>
                    <Button
                        disabled={isSaving}
                        onClick={() => setPathValue(ecosystemdataPath)}>
                        Reset
                    </Button>
                    <Button
                        variant="primary"
                        trailingIcon="folder open"
                        loading={isSaving}
                        disabled={isSaving || !hasChanged}
                        onClick={handleChange}>
                        change path
                    </Button>
                </>}>
                <FormField label="path" htmlFor="ecosystemdata-path">
                    <TextInput
                        id="ecosystemdata-path"
                        placeholder="path"
                        value={pathValue}
                        onChange={(event:any) => setPathValue(event.target.value)}/>
                </FormField>
            </Dialog>
}



  export default EcosystemDataPathModal
