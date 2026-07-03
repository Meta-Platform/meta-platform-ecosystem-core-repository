import * as React from "react"
import {useState, useEffect} from "react"

import { Button, Modal, Form } from "semantic-ui-react"


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

    return <Modal
                open={open}
                closeIcon
                size="tiny"
                onClose={() => onClose()}>
                <Modal.Header>ecosystem data path</Modal.Header>
                <Modal.Content>
                    <Form>
                        <Form.Field>
                            <label>path</label>
                            <input
                                placeholder="path"
                                value={pathValue}
                                onChange={(event) => setPathValue(event.target.value)}/>
                        </Form.Field>
                    </Form>
                </Modal.Content>
                <Modal.Actions>
                    <Button
                        disabled={isSaving}
                        onClick={() => setPathValue(ecosystemdataPath)}>
                        Reset
                    </Button>
                    <Button
                        content="change path"
                        labelPosition="right"
                        icon="folder open"
                        loading={isSaving}
                        disabled={isSaving || !hasChanged}
                        onClick={handleChange}
                        color="orange"/>
                </Modal.Actions>
            </Modal>
}



  export default EcosystemDataPathModal
