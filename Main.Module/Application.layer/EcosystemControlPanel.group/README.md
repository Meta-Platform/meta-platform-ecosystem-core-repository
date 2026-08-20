# EcosystemControlPanel *Group*

O **Ecosystem Control Panel** é o painel de administração do ecossistema: mostra
os repositórios instalados, os executáveis publicados, as fontes registradas e o
que está em execução, e permite operar sobre isso sem sair da interface.

> **Ele administra; não executa.** A execução de pacotes é responsabilidade do
> daemon de instâncias — o painel é um cliente dele.

## Pacotes do grupo

| Pacote | Papel |
|---|---|
| [`ecosystem-control-panel.webgui`](./ecosystem-control-panel.webgui/README.md) | A interface. |
| [`ecosystem-control-panel.webservice`](./ecosystem-control-panel.webservice/README.md) | A API que a interface consome. |
| [`ecosystem-control-panel.webapp`](./ecosystem-control-panel.webapp/README.md) | Compõe os dois sobre um servidor HTTP. |
| [`ecosystem-control-panel.desktopapp`](./ecosystem-control-panel.desktopapp/README.md) | A mesma aplicação numa janela desktop. |
| [`ecosystem-control-panel.service`](./ecosystem-control-panel.service/README.md) | Serviço de domínio do painel. |
| [`ecosystem-control-panel-gui.service`](./ecosystem-control-panel-gui.service/README.md) | Host de GUI para a janela desktop. |

> Veja o [README do repositório](../../../README.md).
