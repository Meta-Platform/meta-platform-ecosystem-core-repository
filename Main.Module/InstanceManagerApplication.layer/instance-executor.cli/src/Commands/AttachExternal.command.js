const { resolve } = require("path")
const { spawn } = require("child_process")

const CommandExecutor = require("../../../../Libraries.layer/command-executor.lib/src/CommandExecutor")
const { DescribeExecution } = require("../../../../Libraries.layer/execution-identity.lib/src/DescribeExecution")

// `executor attach <pacote> -- <comando…>`
//
// Registra no daemon um processo que ele NÃO vai lançar e então executa o
// processo de verdade. Existe por causa do servidor MCP: quem o sobe é o cliente
// de IA, por stdio, então ele nunca aparecia no monitor e não havia como saber
// se a versão no ar era a mais nova (IEXP-24/27).
//
// Três regras, na ordem de importância:
//  1. O processo real manda. stdin/stdout/stderr são herdados sem intermediação
//     (o MCP fala JSON-RPC por stdio: qualquer byte a mais quebra o protocolo) e
//     o código de saída é repassado.
//  2. Daemon fora do ar NÃO impede a execução — o attach é observabilidade, não
//     pré-requisito. Falhou, avisa no stderr e segue.
//  3. Saiu, sai do monitor: detach no exit e nos sinais.
const AttachExternalCommand = async ({ args, startupParams }) => {

    const { packagePath, _: positional = [] } = args
    const {
        platformApplicationSocketPath,
        httpServerManagerEndpoint
    } = startupParams

    // O yargs separa o que vem depois de `--` em `args._` (fora os posicionais
    // já consumidos). O primeiro elemento é o executável; o resto, seus args.
    const rest = positional.map(String).filter((v) => v !== "attach")
    const command = rest[0]
    const commandArgs = rest.slice(1)

    if(!packagePath || !command){
        console.error("uso: executor attach <caminho-do-pacote> -- <comando> [args…]")
        process.exitCode = 2
        return
    }

    const absolutePackagePath = resolve(process.cwd(), packagePath)
    const identity = DescribeExecution({ packagePath: absolutePackagePath, launchedBy: "attach" })

    // 1) Anuncia ao daemon (best-effort).
    let instanceId
    try {
        await CommandExecutor({
            serverResourceEndpointPath: httpServerManagerEndpoint,
            mainApplicationSocketPath: platformApplicationSocketPath,
            CommandFunction: async ({ APIs }) => {
                const API = APIs?.PlatformMainApplicationInstance?.EcosystemManager
                if(!API) throw new Error("daemon sem a API EcosystemManager")
                const result = await API.AttachExternalInstance({
                    packagePath: absolutePackagePath,
                    pid: process.pid,
                    launchedBy: "attach",
                    identity
                })
                instanceId = result && result.instanceId
            }
        })
    } catch(e){
        // stderr, nunca stdout: o stdout pertence ao processo hospedado.
        console.error(`[attach] não foi possível registrar no daemon (${e && e.message ? e.message : e}); seguindo assim mesmo.`)
    }

    // 2) Executa o processo real, herdando os três descritores.
    const child = spawn(command, commandArgs, { stdio: "inherit" })

    let detached = false
    const detach = async () => {
        if(detached || !instanceId) return
        detached = true
        try {
            await CommandExecutor({
                serverResourceEndpointPath: httpServerManagerEndpoint,
                mainApplicationSocketPath: platformApplicationSocketPath,
                CommandFunction: async ({ APIs }) => {
                    const API = APIs?.PlatformMainApplicationInstance?.EcosystemManager
                    if(API) await API.DetachExternalInstance({ instanceId })
                }
            })
        } catch(e){ /* o Reconcile do daemon limpa pelo pid */ }
    }

    // 3) Sinais chegam ao processo real; o registro sai junto.
    for(const signal of ["SIGINT", "SIGTERM", "SIGHUP"])
        process.on(signal, () => { try { child.kill(signal) } catch(e){} })

    await new Promise((done) => {
        child.on("error", async (error) => {
            console.error(`[attach] falha ao executar "${command}": ${error.message}`)
            await detach()
            process.exitCode = 127
            done()
        })
        child.on("exit", async (code, signal) => {
            await detach()
            process.exitCode = signal ? 128 : (code || 0)
            done()
        })
    })
}

module.exports = AttachExternalCommand
