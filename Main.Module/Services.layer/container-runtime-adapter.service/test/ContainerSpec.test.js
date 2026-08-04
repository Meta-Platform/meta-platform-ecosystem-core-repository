/*
    ContainerSpec v1 (CTMG-54 a 57).

    Dois grupos de teste, com pesos diferentes.

    O primeiro é a REGRESSÃO: `CreateNewContainer` tem dois chamadores no
    VirtualDeskRepo — o provisionador da nuvem corporativa e o console do
    MyEcosystem. Se o JSON que chega ao daemon mudar, o provisionamento quebra
    num repositório que este aqui não vê. As chamadas abaixo são cópias
    literais do que aqueles arquivos fazem.

    O segundo é a CONVERSÃO: segundos para nanossegundos, "512m" para bytes,
    cpus para NanoCpus. São contas que, erradas, não dão erro — dão um
    container que se comporta de um jeito que ninguém pediu.
*/
const test = require("node:test")
const assert = require("node:assert/strict")

const BuildContainerCreateOptions = require("../src/Helpers/BuildContainerCreateOptions")
const { NormalizeLegacySpec } = require("../src/Helpers/BuildContainerCreateOptions")
const DescribeContainerSpec = require("../src/Helpers/DescribeContainerSpec")
const { ValidateContainerSpec, BuildHealthcheck } = require("../src/Helpers/ContainerSpec")

/* ======================================================== REGRESSÃO ===== */

test("REGRESSÃO: a chamada do ServiceHandler.create produz o JSON de sempre", () => {
    // Cópia literal de VirtualDeskRepo/service-orchestrator.service/
    // src/Helpers/ServiceHandler.create.js
    const opcoes = BuildContainerCreateOptions({
        imageName: "meu-servico:latest",
        containerName: "servico-01",
        ports: [{ containerPort: 8080, hostPort: 18080 }],
        networkmode: "minha-rede",
        networkAliases: ["servico"],
        mounts: [{ volumeName: "dados-01", target: "/data" }],
        environment: { NODE_ENV: "production", PORTA: 8080 }
    })

    assert.equal(opcoes.Image, "meu-servico:latest")
    assert.equal(opcoes.name, "servico-01")
    assert.deepEqual(opcoes.Env, ["NODE_ENV=production", "PORTA=8080"])
    assert.deepEqual(opcoes.ExposedPorts, { "8080/tcp": {} })
    assert.deepEqual(opcoes.HostConfig.PortBindings, { "8080/tcp": [{ HostPort: "18080" }] })
    assert.equal(opcoes.HostConfig.NetworkMode, "minha-rede")
    assert.deepEqual(opcoes.HostConfig.Mounts, [{
        Type: "volume",
        Source: "dados-01",
        Target: "/data",
        ReadOnly: false
    }])
    assert.deepEqual(
        opcoes.NetworkingConfig.EndpointsConfig["minha-rede"].Aliases,
        ["servico"]
    )
})

test("REGRESSÃO: a chamada do MyEcosystemConsole (só imagem e nome) funciona", () => {
    // Cópia literal de my-workbench.webservice/src/Controllers/
    // MyEcosystemConsole.controller.js
    const opcoes = BuildContainerCreateOptions({
        imageName: "myecosystem:latest",
        containerName: "kadisk-ecosystem-container"
    })

    assert.equal(opcoes.Image, "myecosystem:latest")
    assert.equal(opcoes.name, "kadisk-ecosystem-container")
    assert.deepEqual(opcoes.ExposedPorts, {})
    assert.deepEqual(opcoes.HostConfig.Mounts, [])
    // Sem env nenhum, a chave nem aparece — como era antes.
    assert.equal("Env" in opcoes, false)
})

test("REGRESSÃO: o container legado NÃO ganha campos que ninguém pediu", () => {
    /*
        O risco de um spec com ~60 campos é ele carimbar padrões em quem não
        pediu nada. Restart policy, healthcheck e limites precisam estar
        AUSENTES quando não foram informados.
    */
    const opcoes = BuildContainerCreateOptions({
        imageName: "x", containerName: "y"
    })

    for (const chave of ["RestartPolicy", "Memory", "NanoCpus", "AutoRemove", "Privileged"]) {
        assert.equal(chave in opcoes.HostConfig, false, `HostConfig.${chave} não deveria existir`)
    }
    assert.equal("Healthcheck" in opcoes, false)
    assert.equal("Cmd" in opcoes, false)
})

test("a forma legada é reconhecida e traduzida", () => {
    const spec = NormalizeLegacySpec({
        imageName: "x",
        containerName: "y",
        networkmode: "rede",
        networkAliases: ["a"],
        environment: { A: "1" }
    })

    assert.equal(spec.image, "x")
    assert.equal(spec.name, "y")
    assert.deepEqual(spec.network, { mode: "rede", aliases: ["a"] })
    assert.deepEqual(spec.env, { A: "1" })
})

test("a forma nova passa intacta pela normalização", () => {
    const spec = { image: "x", name: "y", command: ["sh"] }
    assert.deepEqual(NormalizeLegacySpec(spec), spec)
})

/* ======================================================== CONVERSÕES ==== */

test("healthcheck: segundos viram NANOSSEGUNDOS", () => {
    /*
        Mandar 30 onde a API espera 30000000000 produz uma verificação a cada
        30 nanossegundos — um laço infinito que o operador percebe como
        "container instável", sem nenhuma pista da causa.
    */
    const h = BuildHealthcheck({
        test: "curl -f http://localhost/ || exit 1",
        intervalSeconds: 30,
        timeoutSeconds: 5,
        startPeriodSeconds: 10,
        retries: 3
    })

    assert.deepEqual(h.Test, ["CMD-SHELL", "curl -f http://localhost/ || exit 1"])
    assert.equal(h.Interval, 30_000_000_000)
    assert.equal(h.Timeout, 5_000_000_000)
    assert.equal(h.StartPeriod, 10_000_000_000)
    assert.equal(h.Retries, 3)
})

test("healthcheck: lista explícita é respeitada, texto vira CMD-SHELL", () => {
    assert.deepEqual(
        BuildHealthcheck({ test: ["CMD", "pg_isready"] }).Test,
        ["CMD", "pg_isready"]
    )
})

test("healthcheck desativado vira NONE — que é como se desliga o da imagem", () => {
    assert.deepEqual(BuildHealthcheck({ disable: true }), { Test: ["NONE"] })
})

test("recursos: 512m vira bytes e 1.5 cpus vira NanoCpus", () => {
    const o = BuildContainerCreateOptions({
        image: "x",
        resources: { memoryBytes: "512m", cpus: 1.5, pidsLimit: 200 }
    })

    assert.equal(o.HostConfig.Memory, 512 * 1024 * 1024)
    assert.equal(o.HostConfig.NanoCpus, 1_500_000_000)
    assert.equal(o.HostConfig.PidsLimit, 200)
})

test("no-new-privileges vira SecurityOpt, não campo próprio", () => {
    // É o detalhe que faz uma tela oferecer um interruptor sem efeito nenhum.
    const o = BuildContainerCreateOptions({
        image: "x",
        security: { noNewPrivileges: true, securityOpt: ["seccomp=unconfined"] }
    })

    assert.deepEqual(o.HostConfig.SecurityOpt, ["seccomp=unconfined", "no-new-privileges:true"])
})

test("os campos que faltavam chegam todos ao JSON", () => {
    const o = BuildContainerCreateOptions({
        image: "nginx",
        command: ["nginx", "-g", "daemon off;"],
        entrypoint: ["/docker-entrypoint.sh"],
        workingDir: "/app",
        user: "1000:1000",
        hostname: "web",
        labels: { app: "meu", versao: 2 },
        restart: { policy: "on-failure", maximumRetryCount: 3 },
        stopSignal: "SIGQUIT",
        stopTimeoutSeconds: 20,
        extraHosts: ["banco:10.0.0.5"],
        dns: { servers: ["1.1.1.1"], search: ["local"] },
        sysctls: { "net.core.somaxconn": 1024 },
        devices: [{ pathOnHost: "/dev/dri", permissions: "rwm" }],
        logging: { driver: "json-file", options: { "max-size": "10m" } },
        namespaces: { shmSizeBytes: 67108864 }
    })

    assert.deepEqual(o.Cmd, ["nginx", "-g", "daemon off;"])
    assert.deepEqual(o.Entrypoint, ["/docker-entrypoint.sh"])
    assert.equal(o.WorkingDir, "/app")
    assert.equal(o.User, "1000:1000")
    assert.equal(o.Hostname, "web")
    // valor numérico em label vira texto, que é o que a API exige
    assert.deepEqual(o.Labels, { app: "meu", versao: "2" })
    assert.deepEqual(o.HostConfig.RestartPolicy, { Name: "on-failure", MaximumRetryCount: 3 })
    assert.equal(o.StopSignal, "SIGQUIT")
    assert.equal(o.StopTimeout, 20)
    assert.deepEqual(o.HostConfig.ExtraHosts, ["banco:10.0.0.5"])
    assert.deepEqual(o.HostConfig.Dns, ["1.1.1.1"])
    assert.deepEqual(o.HostConfig.Sysctls, { "net.core.somaxconn": "1024" })
    assert.deepEqual(o.HostConfig.Devices, [{
        PathOnHost: "/dev/dri", PathInContainer: "/dev/dri", CgroupPermissions: "rwm"
    }])
    assert.deepEqual(o.HostConfig.LogConfig, { Type: "json-file", Config: { "max-size": "10m" } })
    assert.equal(o.HostConfig.ShmSize, 67108864)
})

/* ======================================================== VALIDAÇÃO ===== */

test("a validação devolve TODOS os erros de uma vez, sem lançar", () => {
    /*
        Um formulário de oito abas precisa marcar tudo junto. Lançar na
        primeira falha faria o usuário descobrir os problemas um por
        tentativa de submeter.
    */
    const { valid, errors } = ValidateContainerSpec({
        name: "nome inválido com espaço",
        restart: { policy: "sempre" },
        resources: { memoryBytes: "muito" }
    })

    assert.equal(valid, false)
    const campos = errors.map((e) => e.field).sort()
    assert.deepEqual(campos, ["image", "name", "resources.memoryBytes", "restart.policy"])
})

test("spec mínimo válido passa", () => {
    assert.equal(ValidateContainerSpec({ image: "nginx" }).valid, true)
})

test("maximumRetryCount sem on-failure é recusado ANTES do daemon", () => {
    // O daemon recusa, mas falando de "MaximumRetryCount" — campo que ninguém
    // preencheu com esse nome.
    const { errors } = ValidateContainerSpec({
        image: "x", restart: { policy: "always", maximumRetryCount: 5 }
    })

    assert.equal(errors[0].field, "restart.maximumRetryCount")
})

test("reserva de memória maior que o limite é recusada", () => {
    // O daemon aceita, e não faz sentido: reserva é piso, limite é teto.
    const { errors } = ValidateContainerSpec({
        image: "x", resources: { memoryBytes: "256m", memoryReservationBytes: "512m" }
    })

    assert.equal(errors[0].field, "resources.memoryReservationBytes")
})

test("healthcheck sem comando é recusado, a menos que esteja desativado", () => {
    assert.equal(
        ValidateContainerSpec({ image: "x", healthcheck: { intervalSeconds: 30 } }).errors[0].field,
        "healthcheck.test"
    )
    assert.equal(
        ValidateContainerSpec({ image: "x", healthcheck: { disable: true } }).valid,
        true
    )
})

/* ==================================================== IDA E VOLTA ======= */

test("descrever o que foi construído devolve o spec de origem", () => {
    /*
        É o teste que sustenta editar, duplicar e copiar o docker run: se a
        volta perder um campo, "editar" passa a significar "editar e perder o
        que não coube".
    */
    const original = {
        image: "postgres:16",
        name: "banco",
        env: { POSTGRES_PASSWORD: "segredo" },
        labels: { app: "meu" },
        ports: [{ containerPort: 5432, hostPort: 15432 }],
        mounts: [{ type: "volume", source: "pgdata", target: "/var/lib/postgresql/data" }],
        restart: { policy: "unless-stopped" },
        resources: { memoryBytes: 536870912, cpus: 1.5 },
        healthcheck: { test: "pg_isready", intervalSeconds: 30, retries: 3 },
        user: "postgres",
        workingDir: "/var/lib/postgresql"
    }

    const criado = BuildContainerCreateOptions(original)

    // O inspect tem a mesma forma do que foi enviado, mais o nome com barra.
    const inspecaoSimulada = {
        Name: "/banco",
        Config: {
            Image: criado.Image,
            Env: criado.Env,
            Labels: criado.Labels,
            ExposedPorts: criado.ExposedPorts,
            Healthcheck: criado.Healthcheck,
            User: criado.User,
            WorkingDir: criado.WorkingDir
        },
        HostConfig: criado.HostConfig,
        Mounts: [{ Type: "volume", Name: "pgdata", Destination: "/var/lib/postgresql/data", RW: true }],
        NetworkSettings: { Networks: {} }
    }

    const devolvido = DescribeContainerSpec(inspecaoSimulada)

    assert.equal(devolvido.image, original.image)
    assert.equal(devolvido.name, original.name)
    assert.deepEqual(devolvido.env, original.env)
    assert.deepEqual(devolvido.labels, original.labels)
    assert.deepEqual(devolvido.ports, original.ports)
    assert.deepEqual(devolvido.mounts, [{
        type: "volume", source: "pgdata", target: "/var/lib/postgresql/data"
    }])
    assert.deepEqual(devolvido.restart, { policy: "unless-stopped" })
    assert.equal(devolvido.resources.memoryBytes, 536870912)
    assert.equal(devolvido.resources.cpus, 1.5)
    assert.equal(devolvido.healthcheck.test, "pg_isready")
    assert.equal(devolvido.healthcheck.intervalSeconds, 30)
    assert.equal(devolvido.user, "postgres")
})

test("a volta NÃO devolve o ambiente que veio da imagem", () => {
    /*
        O inspect traz também o que a imagem definiu — PATH é o exemplo
        universal. Recriar repetindo isso congelaria um PATH que deveria vir da
        imagem nova quando ela for atualizada.
    */
    const spec = DescribeContainerSpec({
        Config: {
            Image: "node:22",
            Env: ["PATH=/usr/local/bin", "NODE_VERSION=22", "MINHA=1"]
        },
        ImageConfig: { Env: ["PATH=/usr/local/bin", "NODE_VERSION=22"] },
        HostConfig: {},
        NetworkSettings: {}
    })

    assert.deepEqual(spec.env, { MINHA: "1" })
})

test("a volta omite o que está vazio, em vez de encher o spec de nulos", () => {
    const spec = DescribeContainerSpec({
        Config: { Image: "alpine" },
        HostConfig: { RestartPolicy: { Name: "no" } },
        NetworkSettings: {}
    })

    assert.deepEqual(Object.keys(spec).sort(), ["image"])
})
