# O guia de estilo mudou de endereço

O **Meta System Retro-Brutalist UI — guia de estilo** agora vive junto da
matriz que ele descreve:

`UserInterface.Module/Libraries.layer/i-components.uilib/docs/ui-style-guide.md`

## Por que saiu daqui

A estética nasceu neste painel, e o guia nasceu com ela. Mas treze aplicativos
passaram a seguir o padrão, e um consumidor não pode ser o dono do documento que
os outros doze obedecem — foi essa mesma assimetria que produziu o fork de CSS
que a F8 eliminou.

Três afirmações do texto antigo também tinham ficado falsas: a cadeia de estilos
não começa mais pela folha do Semantic, `CorporateTheme.css` não existe mais, e
o kit deixou de ter dependência de terceiro na base.

## O que ainda é deste painel

- `src/Styles/control-panel.css` — CSS de produto, prefixo `.ecp-`, escrito
  sobre os tokens. É a única folha local, e não redefine nenhuma classe `.mp-*`.
- Componentes finos em cima do kit: `Breadcrumbs`, `CopyValue`, `PackageIcon`,
  `ToastContainer`.
