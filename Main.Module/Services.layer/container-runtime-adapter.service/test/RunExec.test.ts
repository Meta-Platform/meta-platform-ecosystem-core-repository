/*
    Exec de uma tacada (CTMG-42).

    Tudo aqui roda sem Docker: o cliente do runtime entra por `CreateClient`
    (CTMG-30) e um falso responde no lugar dele. É o que permite verificar o
    que de fato importa nesta operação — separar stdout de stderr, propagar o
    código de saída e não travar para sempre quando o comando não termina.
*/
const test = require("node:test")
const assert = require("node:assert/strict")
const { PassThrough } = require("node:stream")

const ContainerManager = require("../src/Managers/Container.manager")

// Monta um quadro do protocolo do Docker: [tipo][0][0][0][tamanho:4 BE] + payload.
const Quadro = (tipo, texto) => {
    const carga = Buffer.from(texto, "utf-8")
    const cabecalho = Buffer.alloc(8)
    cabecalho[0] = tipo === "stderr" ? 2 : 1
    cabecalho.writeUInt32BE(carga.length, 4)
    return Buffer.concat([cabecalho, carga])
}

/*
    Docker falso. `quadros` é o que o exec "escreve"; `exitCode` é o que o
    inspect devolve; `nuncaTermina` simula o comando pendurado, que é o caso
    que o timeout existe para resolver.
*/
const DockerFalso = ({ quadros = [], exitCode = 0, nuncaTermina = false } = {}) => {
    const registrado = {}

    return {
        cliente: {
            getEvents: () => {},
            getContainer: (nome) => {
                registrado.containerIdOrName = nome
                return {
                    exec: async (opcoes) => {
                        registrado.exec = opcoes
                        return {
                            start: async (inicio) => {
                                registrado.start = inicio
                                const fluxo = new PassThrough()
                                // Escreve depois que quem chamou registrou os ouvintes.
                                setImmediate(() => {
                                    quadros.forEach((q) => fluxo.write(q))
                                    if (!nuncaTermina) fluxo.end()
                                })
                                return fluxo
                            },
                            inspect: async () => ({ ExitCode: exitCode, Running: nuncaTermina })
                        }
                    }
                }
            }
        },
        registrado
    }
}

const CriarAdaptador = (configuracao) => {
    const { cliente, registrado } = DockerFalso(configuracao)
    const adaptador = ContainerManager({
        socketPath: "/tmp/irrelevante.sock",
        CreateClient: () => cliente
    })
    return { adaptador, registrado }
}

test("stdout e stderr voltam SEPARADOS", async () => {
    // Com TTY os dois viriam misturados e "o que foi para o erro?" ficaria sem
    // resposta — que é a pergunta de quem usa esta operação.
    const { adaptador } = CriarAdaptador({
        quadros: [
            Quadro("stdout", "linha de saída\n"),
            Quadro("stderr", "algo deu errado\n"),
            Quadro("stdout", "mais saída\n")
        ]
    })

    const resultado = await adaptador.RunExec({
        containerIdOrName: "meu-container",
        cmd: ["sh", "-c", "echo oi"]
    })

    assert.equal(resultado.stdout, "linha de saída\nmais saída\n")
    assert.equal(resultado.stderr, "algo deu errado\n")
})

test("o código de saída é propagado", async () => {
    const { adaptador } = CriarAdaptador({ exitCode: 42 })

    const resultado = await adaptador.RunExec({
        containerIdOrName: "c",
        cmd: ["false"]
    })

    assert.equal(resultado.exitCode, 42)
    assert.equal(resultado.timedOut, false)
})

test("código de saída ZERO não vira null", async () => {
    // `ExitCode || null` transformaria sucesso em "não sei" — 0 é falsy.
    const { adaptador } = CriarAdaptador({ exitCode: 0 })

    const resultado = await adaptador.RunExec({ containerIdOrName: "c", cmd: ["true"] })

    assert.equal(resultado.exitCode, 0)
})

test("o exec é pedido SEM TTY, que é o que separa os fluxos", async () => {
    const { adaptador, registrado } = CriarAdaptador()

    await adaptador.RunExec({ containerIdOrName: "c", cmd: ["ls"] })

    assert.equal(registrado.exec.Tty, false)
    assert.equal(registrado.exec.AttachStdin, false)
    assert.equal(registrado.exec.AttachStdout, true)
    assert.equal(registrado.exec.AttachStderr, true)
})

test("usuário, diretório e ambiente chegam ao exec", async () => {
    const { adaptador, registrado } = CriarAdaptador()

    await adaptador.RunExec({
        containerIdOrName: "c",
        cmd: ["env"],
        user: "root",
        workingDir: "/app",
        env: { NIVEL: "debug", VAZIO: null }
    })

    assert.equal(registrado.exec.User, "root")
    assert.equal(registrado.exec.WorkingDir, "/app")
    assert.deepEqual(registrado.exec.Env, ["NIVEL=debug"])
})

test("ambiente também aceita a lista da API do Docker", async () => {
    const { adaptador, registrado } = CriarAdaptador()

    await adaptador.RunExec({ containerIdOrName: "c", cmd: ["env"], env: ["A=1", "B=2"] })

    assert.deepEqual(registrado.exec.Env, ["A=1", "B=2"])
})

test("sem usuário, diretório ou ambiente, os campos NÃO são enviados", async () => {
    // Mandar User:"" ou WorkingDir:"" muda o comportamento do runtime; ausência
    // e vazio não são a mesma coisa.
    const { adaptador, registrado } = CriarAdaptador()

    await adaptador.RunExec({ containerIdOrName: "c", cmd: ["ls"] })

    assert.equal("User" in registrado.exec, false)
    assert.equal("WorkingDir" in registrado.exec, false)
    assert.equal("Env" in registrado.exec, false)
})

test("comando ausente ou vazio é RECUSADO como erro de entrada", async () => {
    const { adaptador } = CriarAdaptador()

    for (const cmd of [undefined, [], "ls -la"]) {
        await assert.rejects(
            () => adaptador.RunExec({ containerIdOrName: "c", cmd }),
            (erro) => erro.code === "INVALID_EXEC_COMMAND" && erro.statusCode === 400
        )
    }
})

test("comando que não termina EXPIRA, em vez de pendurar quem chamou", async () => {
    const { adaptador } = CriarAdaptador({
        quadros: [Quadro("stdout", "comecei\n")],
        nuncaTermina: true,
        exitCode: null
    })

    const resultado = await adaptador.RunExec({
        containerIdOrName: "c",
        cmd: ["sleep", "999"],
        timeoutMs: 60
    })

    assert.equal(resultado.timedOut, true)
    // A saída que chegou ANTES de expirar é entregue: é o que diz onde travou.
    assert.equal(resultado.stdout, "comecei\n")
})

test("fluxo cru (sem quadro) não é descartado", async () => {
    // Runtime nem sempre enquadra o que prometeu enquadrar — o decodificador
    // observa o formato. Ver DecodeDockerStream.js.
    const { adaptador } = CriarAdaptador({
        quadros: [Buffer.from("saída sem enquadramento\n", "utf-8")]
    })

    const resultado = await adaptador.RunExec({ containerIdOrName: "c", cmd: ["ls"] })

    assert.equal(resultado.stdout, "saída sem enquadramento\n")
    assert.equal(resultado.stderr, "")
})

test("o container pedido é o container usado", async () => {
    const { adaptador, registrado } = CriarAdaptador()

    await adaptador.RunExec({ containerIdOrName: "postgres-do-projeto", cmd: ["ls"] })

    assert.equal(registrado.containerIdOrName, "postgres-do-projeto")
})
