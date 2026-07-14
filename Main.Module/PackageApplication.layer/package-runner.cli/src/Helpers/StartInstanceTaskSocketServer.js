const fs = require("fs")
const path = require("path")

// Expõe o task-executor DESTE processo `run` num Unix socket, no padrão
// server-manager (HTTP-sobre-unix), para que o daemon `executor-manager` consulte
// as tarefas internas desta instância pelo mesmo `instance-manager-client.lib`.
//
// Publica duas superfícies:
//   /server-manager        → status (o MountAPIs do cliente descobre a superfície aqui)
//   /task-executor-machine → ListTasks / GetTask / StopTasks (o adaptador recebido)
//
// É best-effort: se algo falhar, a instância continua rodando normalmente — o
// socket é só observabilidade, não pode derrubar o processo.
const StartInstanceTaskSocketServer = ({
    socketPath,
    serverName,
    taskExecutorMachineService,
    serverManagerServiceLib,
    serverManagerWebserviceLib
}) => {

    const HTTPServerService              = serverManagerServiceLib.require("Services/HTTPServer.service")
    const HTTPServersController          = serverManagerWebserviceLib.require("Controllers/HTTPServers.controller")
    const httpServersApiTemplate         = serverManagerWebserviceLib.require("APIs/HTTPServers.api.json")
    const taskExecutorMachineApiTemplate = require("../APIs/TaskExecutorMachine.api.json")

    // O bind num Unix socket exige que o diretório exista.
    fs.mkdirSync(path.dirname(socketPath), { recursive: true })

    return new Promise((resolve, reject) => {
        try {
            const serverService = HTTPServerService({
                name: serverName,
                port: socketPath,
                onReady: () => {
                    // Status primeiro; o _Status lê a lista de serviços em tempo de
                    // request, então já reportará também o endpoint abaixo.
                    serverService.AddServiceEndpoint({
                        path: "/server-manager",
                        apiTemplate: httpServersApiTemplate,
                        service: HTTPServersController({ httpServerService: serverService })
                    })
                    serverService.AddServiceEndpoint({
                        path: "/task-executor-machine",
                        apiTemplate: taskExecutorMachineApiTemplate,
                        service: taskExecutorMachineService
                    })
                    resolve(serverService)
                }
            })
        } catch(e) {
            reject(e)
        }
    })
}

module.exports = StartInstanceTaskSocketServer
