const { join } = require("path")
const { rmSync } = require("fs")

// Sobe e MANTÉM VIVO o daemon executor-manager (ecosystem-instance-manager.app).
// Reinicia o daemon automaticamente se ele cair (via @/process-supervisor.lib).
const StartCommand = async ({ startupParams, params }) => {

    const {
        ecosystemDataPath,
        executablesDirName,
        targetExecutable,
        instanceManagerSocketPath,
        supervisorSocketPath
    } = startupParams

    const { processSupervisorLib } = params
    const CreateProcessSupervisor = processSupervisorLib.require("CreateProcessSupervisor")

    const executablesDirPath = join(ecosystemDataPath, executablesDirName)
    const command = join(executablesDirPath, targetExecutable)

    const _Log = (message) => {
        const stamp = new Date().toISOString()
        console.log(`[${stamp}] [instance-manager-daemon] ${message}`)
    }

    const supervisor = CreateProcessSupervisor({
        command,
        args: [],
        cwd: ecosystemDataPath,
        env: { ...process.env, PATH: `${executablesDirPath}:${process.env.PATH}` },
        // Antes de cada (re)início, remove os sockets stale do daemon (o HTTP/WS
        // e o de supervisão) para o bind não falhar com EADDRINUSE.
        beforeSpawn: () => {
            for(const socketPath of [instanceManagerSocketPath, supervisorSocketPath]){
                if(socketPath){
                    try { rmSync(socketPath, { force: true }) } catch(e){}
                }
            }
        },
        onEvent: (event) => {
            switch(event.type){
                case "starting":    _Log(`iniciando daemon: ${event.command}`); break
                case "exited":      _Log(`daemon encerrou (code=${event.code}${event.signal ? `, signal=${event.signal}` : ""})`); break
                case "restarting":  _Log(`reiniciando em ${event.inMs}ms`); break
                case "error":       _Log(`erro: ${event.message}`); break
            }
        }
    })

    _Log(`supervisionando ${command} (auto-restart)`)
    supervisor.Start()

    // Mantém o processo do supervisor vivo indefinidamente.
    await new Promise(() => {})
}

module.exports = StartCommand
