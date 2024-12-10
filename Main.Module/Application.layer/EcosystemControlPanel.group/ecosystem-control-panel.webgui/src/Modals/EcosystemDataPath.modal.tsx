import * as React from "react"
import {useState, useEffect} from "react"

import { Button, Modal, Form } from "semantic-ui-react"


type ModalProps = {
    ecosystemdataPath : string
    open              : boolean
    onClose           : Function
}

const EcosystemDataPathModal = ({ ecosystemdataPath, open, onClose }:ModalProps) =>{

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
                            <input placeholder="path" defaultValue={ecosystemdataPath}/>
                        </Form.Field>
                    </Form> 
                </Modal.Content>
                <Modal.Actions>
                    <Button onClick={() => {}}>
                        Reset
                    </Button>
                    <Button
                        content="change path"
                        labelPosition="right"
                        icon="folder open"
                        onClick={() => {}}
                        color="orange"/>
                </Modal.Actions>
            </Modal>
}
    
  

  export default EcosystemDataPathModal