import * as React from "react"
import { Button, Dialog } from "@i-components"

// Modal base padronizado para todo o painel. Três variantes:
//  - info   : informação/confirmação simples (confirmar primário)
//  - edit   : alteração sensível (confirmar em tom de atenção)
//  - danger : ação destrutiva (confirmar vermelho, foco inicial em CANCELAR)
//
// O realce por variante (fundo do cabeçalho + cor do botão de confirmar) vem do
// CSS de produto (.ecp-modal--*, em Styles/parts/pages.css), porque o `Dialog`
// do kit não expõe `className` nem tom.
const VARIANT:any = {
    info:   { icon: "info circle",  confirmVariant: "primary", confirmClassName: "" },
    edit:   { icon: "pencil",       confirmVariant: "primary", confirmClassName: "ecp-modal__confirm--edit" },
    danger: { icon: "warning sign", confirmVariant: "danger",  confirmClassName: "" }
}

// O `size` continua sendo declarado no vocabulário do painel (small/tiny/…);
// aqui ele é traduzido para as larguras do Dialog do kit.
const SIZE:any = {
    mini      : "sm",
    tiny      : "sm",
    small     : "sm",
    large     : "lg",
    fullscreen: "xl"
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

    // fechado = nada no DOM (era o comportamento do <Modal open={false}>), para
    // que o invólucro da variante não deixe um nó vazio na árvore.
    if(open === false) return null

    const v = VARIANT[variant] || VARIANT.info
    const isDanger = variant === "danger"

    // Enquanto salva, o modal não fecha por scrim/Escape (era closeOnDimmerClick={!loading}).
    const handleClose = loading || !onCancel ? undefined : () => onCancel()

    return <div className={`ecp-modal ecp-modal--${variant}`}>
        <Dialog
            open={open}
            size={SIZE[size] || "sm"}
            icon={v.icon}
            title={header}
            onClose={handleClose}
            actions={<>
                <Button
                    onClick={onCancel}
                    disabled={loading}
                    /* em ações destrutivas, o foco inicial vai para cancelar */
                    autoFocus={isDanger}>
                    {cancelText}
                </Button>
                <Button
                    variant={v.confirmVariant}
                    className={v.confirmClassName}
                    icon={confirmIcon}
                    loading={loading}
                    disabled={confirmDisabled}
                    onClick={onConfirm}
                    autoFocus={!isDanger}>
                    {confirmText}
                </Button>
            </>}>
            {children}
        </Dialog>
    </div>
}

export default AppModal
