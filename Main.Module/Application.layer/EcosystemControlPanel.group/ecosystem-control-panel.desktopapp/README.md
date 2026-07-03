# Ecosystem Control Panel (Desktop)

Versão **desktop** do Ecosystem Control Panel (`eco-panel`): roda a mesma
aplicação web do
[`ecosystem-control-panel.webapp`](../ecosystem-control-panel.webapp) dentro de
uma janela [Electron](https://www.electronjs.org/), sem depender do navegador.

É um package do tipo [`.desktopapp`](https://github.com/Meta-Platform/meta-platform-open-standard/blob/main/concepts/package.md).
O `metadata/boot.json` combina:

- a **composição do webapp** (`services` + `endpoints`): sobe um `@@/server-service`
  HTTP e todos os serviços do painel (monitoramento de instâncias, ecosystem-data,
  repository-manager, etc.) mais o `ecosystem-control-panel.webgui`;
- uma seção **`windows`**: abre uma janela Electron com
  `loadURL(http://localhost:{{port}}/)` apontando para esse servidor local.

A janela só abre depois que o `@@/server-service` está `ACTIVE` (via
`agentLinkRules`), exibindo uma tela de carregamento até o webgui terminar de
compilar. Roda na porta `9997` por padrão (o webapp usa `9998`).
