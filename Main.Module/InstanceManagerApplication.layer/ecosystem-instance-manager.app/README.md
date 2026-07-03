# ecosystem-instance-manager.app

Aplicação principal e a primeira a iniciar pela plataforma — executável
`executor-manager`.

O Ecosystem Instance Manager utiliza os mesmos pacotes de runtime que o
`meta-platform-package-executor-command-line` usa para executar, mas atua como o
**daemon** que fornece uma API REST para controle de execução (endpoints
`/task-executor-machine`, `/repository-manager`, `/ecosystem-manager` e
`/enviroment-runtime` — ver [`metadata/endpoint-group.json`](./metadata/endpoint-group.json)).
