# Meta Ecosystem Core Repository

## Modules
### **Main** *Module*
- **Application** *layer*
    - [**ecosystem-daemon-launcher** *command line application*](./Main.Module/Application.layer/ecosystem-daemon-launcher.cli/README.md)
    - [**ecosystem-instance-manager** *application*](./Main.Module/Application.layer/ecosystem-instance-manager.app/README.md)
    - **EcosystemControlPanel** *group*
        - [**ecosystem-control-panel** *web application*](./Main.Module/Application.layer/EcosystemControlPanel.group/ecosystem-control-panel.webapp/README.md)
        - [**ecosystem-control-panel** *web gui*](./Main.Module/Application.layer/EcosystemControlPanel.group/ecosystem-control-panel.webgui/)
        - [**ecosystem-control-panel** *web service*](./Main.Module/Application.layer/EcosystemControlPanel.group/ecosystem-control-panel.webservice/README.md)
    - **instance-executor** *command line application*
    - [**repository-explorer** *command line application*](./Main.Module/Application.layer/repository-explorer.cli/README.md)
    - **ServerManager** *group*
        - [**server-manager** *web application*](./Main.Module/Application.layer/ServerManager.group/server-manager.webapp/README.md)
- **Libraries** *layer*
    - **command-executor** *library*
    - **mount-api** *library*
- **Services** *layer*
    - **ecosystem-manager** *service*
    - **environment-runtime-manager** *service*
    - **repository-manager** *service*
    - **server-manager** *service*
    - **task-executor-machine** *service*
- **Webservices** *layer*
    - [**server-manager** *web service*](./Main.Module/Webservices.layer/server-manager.webservice/README.md)