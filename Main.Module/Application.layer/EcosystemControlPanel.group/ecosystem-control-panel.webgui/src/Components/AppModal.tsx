import * as React from "react"
import { Button, Icon, Modal } from "semantic-ui-react"

// Modal base padronizado para todo o painel. Três variantes:
//  - info   : informação/confirmação simples (confirmar azul)
//  - edit   : alteração sensível (confirmar laranja)
//  - danger : ação destrutiva (confirmar vermelho, foco inicial em CANCELAR)
const VARIANT:any = {
    info:   { icon: "info circle",  iconColor: undefined, confirmColor: "blue"   },
    edit:   { icon: "pencil",       iconColor: undefined, confirmColor: "orange" },
    danger: { icon: "warning sign", iconColor: "red",     confirmColor: "red"    }
}

const AppModal = ({
    open,
    variant = "info",
    header,
    children,
    onCancel,
    onConfirm,
    confirmText = "confirm",
    cancelText = "cancel",
    confirmIcon,
    confirmDisabled = false,
    loading = false,
    size = "small"
}:any) => {

    const v = VARIANT[variant] || VARIANT.info
    const isDanger = variant === "danger"

    return <Modal size={size} open={open} onClose={() => !loading && onCancel && onCancel()} closeOnDimmerClick={!loading}>
        <Modal.Header className={`mp-modal-head mp-modal-head--${variant}`}>
            <Icon name={v.icon} color={v.iconColor}/> {header}
        </Modal.Header>
        <Modal.Content scrolling>
            {children}
        </Modal.Content>
        <Modal.Actions>
            <Button
                onClick={onCancel}
                disabled={loading}
                /* em ações destrutivas, o foco inicial vai para cancelar */
                autoFocus={isDanger}>
                {cancelText}
            </Button>
            <Button
                color={v.confirmColor}
                loading={loading}
                disabled={confirmDisabled}
                onClick={onConfirm}
                autoFocus={!isDanger}>
                { confirmIcon && <Icon name={confirmIcon}/> }{confirmText}
            </Button>
        </Modal.Actions>
    </Modal>
}

export default AppModal
