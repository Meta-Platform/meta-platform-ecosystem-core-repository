# Meta Ecosystem Core Repository

## Modules
### **Main** *Module*
- **Application** *layer*
    - **ecosystem-daemon-launcher** *command line application*
    - **execution-supervisor** *command line application*
    - **platform-executor** *command line application*
    - **platform-main-application** *application*
    - **repository-manager** *command line application*
- **Services** *layer*
    - **ecosystem-manager** *service*
    - **environment-runtime-manager** *service*
    - **repository-manager** *service*
    - **server-manager** *service*
    - **task-executor-machine** *service*
- **Webservices** *layer*
    - **server-manager** *web service*

# Visão Geral do Repositório Ecosystem Core

Este repositório está estruturado para organizar vários módulos da aplicação Ecosystem Core. Abaixo está uma visão geral da estrutura de diretórios.

## Estrutura de Diretórios

### Main.Module
Módulo principal contendo todos os submódulos essenciais da aplicação.

#### Application.layer
Contém as aplicações principais e interfaces de linha de comando.
- **platform-main-application.app**
- **repository-manager.cli**
- **platform-executor.cli**

#### Libraries.layer
Contém bibliotecas compartilhadas usadas em toda a aplicação.
- **logging-library.lib**
- **data-access.lib**

#### Services.layer
Serviços que fornecem funcionalidades de fundo para a aplicação.
- **server-manager.service**
- **task-executor-machine.service**

#### Webservices.layer
Serviços web que expõem funcionalidades via HTTP.
- **server-manager.webservice**

## Licença
Este projeto está licenciado sob a Licença BSD 3-Clause - veja o arquivo LICENSE para detalhes.