/*
    Normalização da entrada de criação de container (CTMG-26, CTMG-28, CTMG-31).

    Aqui moram as duas traduções que estavam erradas e o costume que estava
    implícito:

    1. MONTAGENS. O adaptador filtrava as montagens por `{volumeName, target}`
       e `{hostPath, target}`. Quem chamava com o vocabulário do Docker
       (`{Type, Source, Target}`) via tudo ser DESCARTADO em silêncio: o
       container nascia sem volume nenhum e nenhum erro era levantado. Filtrar
       o que não se reconhece é a pior resposta possível — a operação acontece,
       parece bem-sucedida, e o dado que deveria persistir some.

       Agora há um formato só, as formas antigas são traduzidas, e o que não
       for reconhecido é RECUSADO com o campo citado.

    2. PORTAS. `hostPort.toString()` rodava sem checagem: expor uma porta sem
       publicá-la — caso normal para quem só quer acesso interno — quebrava com
       TypeError. E o protocolo estava fixo em `/tcp`, o que tornava UDP
       impossível de pedir.

    3. GRUPOS DO HOST. Todo container herdava `process.getgroups()` do processo
       do adaptador, inclusive o grupo `docker`. Isso é necessário para quem
       monta o socket do runtime dentro do container, e é surpreendente para
       todo o resto. Vira escolha explícita.

    Funções PURAS, em arquivo próprio, pela mesma razão dos outros helpers
    deste pacote: a regra que decide o que o container recebe precisa ser
    verificável sem runtime.
*/

const TIPOS_DE_MONTAGEM = ["volume", "bind", "tmpfs"]
const PROTOCOLOS = ["tcp", "udp", "sctp"]

const CriarErro = (code, message, field) => {
    const erro = new Error(message)
    erro.code = code
    if (field !== undefined) erro.field = field
    return erro
}

/*
    Aceita, para a mesma montagem:
      { type, source, target, readOnly }        forma canônica
      { volumeName, target }                     legado do orquestrador
      { hostPath, target }                       legado de bind mount
      { Type, Source, Target, ReadOnly }         vocabulário do Docker
*/
const NormalizeMount = (montagem, indice) => {
    if (!montagem || typeof montagem !== "object") {
        throw CriarErro("INVALID_MOUNT", `Montagem ${indice} não é um objeto.`, `mounts[${indice}]`)
    }

    const tipoBruto = montagem.type || montagem.Type
    const origem = montagem.source || montagem.Source || montagem.volumeName || montagem.hostPath
    const destino = montagem.target || montagem.Target
    const somenteLeitura = Boolean(montagem.readOnly || montagem.ReadOnly)

    if (!destino) {
        throw CriarErro(
            "INVALID_MOUNT",
            `Montagem ${indice} sem destino no container.`,
            `mounts[${indice}].target`
        )
    }

    /*
        Sem tipo declarado, deduz pelo campo legado que veio: `volumeName` é
        volume, `hostPath` é bind. Deduzir de outro jeito seria adivinhar.
    */
    const tipo = tipoBruto
        ? String(tipoBruto).toLowerCase()
        : montagem.hostPath ? "bind" : "volume"

    if (!TIPOS_DE_MONTAGEM.includes(tipo)) {
        throw CriarErro(
            "INVALID_MOUNT",
            `Tipo de montagem desconhecido em ${indice}: ${tipoBruto}. Use um de: ${TIPOS_DE_MONTAGEM.join(", ")}.`,
            `mounts[${indice}].type`
        )
    }

    // tmpfs vive na memória: não tem origem, e exigir uma seria mentira.
    if (tipo !== "tmpfs" && !origem) {
        throw CriarErro(
            "INVALID_MOUNT",
            `Montagem ${indice} do tipo ${tipo} sem origem.`,
            `mounts[${indice}].source`
        )
    }

    if (tipo === "bind" && !String(origem).startsWith("/")) {
        throw CriarErro(
            "INVALID_MOUNT",
            `Bind mount ${indice} precisa de caminho absoluto no host: ${origem}`,
            `mounts[${indice}].source`
        )
    }

    if (tipo === "tmpfs") {
        return {
            Type: "tmpfs",
            Target: destino,
            ...(montagem.sizeBytes ? { TmpfsOptions: { SizeBytes: Number(montagem.sizeBytes) } } : {})
        }
    }

    if (tipo === "bind") {
        return {
            Type: "bind",
            Source: origem,
            Target: destino,
            ReadOnly: somenteLeitura,
            BindOptions: { CreateMountpoint: true }
        }
    }

    return {
        Type: "volume",
        Source: origem,
        Target: destino,
        ReadOnly: somenteLeitura
    }
}

const NormalizeMounts = (mounts = []) => {
    if (!Array.isArray(mounts)) {
        throw CriarErro("INVALID_MOUNT", "mounts precisa ser uma lista.", "mounts")
    }
    return mounts.map(NormalizeMount)
}

/*
    Devolve `{ exposedPorts, portBindings }` prontos para a API.

    Porta sem `hostPort` é EXPOSTA e não publicada — o container fica
    alcançável dentro da rede e nada é aberto no host.
*/
const NormalizePorts = (ports = []) => {
    if (!Array.isArray(ports)) {
        throw CriarErro("INVALID_PORT", "ports precisa ser uma lista.", "ports")
    }

    const exposedPorts = {}
    const portBindings = {}

    ports.forEach((porta, indice) => {
        if (!porta || porta.containerPort === undefined || porta.containerPort === null || porta.containerPort === "") {
            throw CriarErro(
                "INVALID_PORT",
                `Porta ${indice} sem a porta do container.`,
                `ports[${indice}].containerPort`
            )
        }

        const protocolo = String(porta.protocol || "tcp").toLowerCase()
        if (!PROTOCOLOS.includes(protocolo)) {
            throw CriarErro(
                "INVALID_PORT",
                `Protocolo desconhecido em ${indice}: ${porta.protocol}. Use um de: ${PROTOCOLOS.join(", ")}.`,
                `ports[${indice}].protocol`
            )
        }

        const chave = `${porta.containerPort}/${protocolo}`
        exposedPorts[chave] = {}

        const temPortaNoHost = porta.hostPort !== undefined
            && porta.hostPort !== null
            && porta.hostPort !== ""

        if (!temPortaNoHost) return

        portBindings[chave] = [{
            HostPort: String(porta.hostPort),
            ...(porta.hostIp ? { HostIp: String(porta.hostIp) } : {})
        }]
    })

    return { exposedPorts, portBindings }
}

/*
    Grupos suplementares do host.

    Herdar os grupos do processo do adaptador é o que faz um bind mount de
    recurso group-owned do host (o `docker.sock`, tipicamente) ser acessível
    dentro do container. É necessário para o orquestrador e indesejado para
    quem só quer subir um Postgres — por isso passa a ser pedido, não suposto.
*/
const ResolveGroupAdd = ({ groupAdd, inheritHostGroups } = {}) => {
    if (Array.isArray(groupAdd) && groupAdd.length > 0) {
        return groupAdd.map(String)
    }
    if (!inheritHostGroups) return []
    return typeof process.getgroups === "function"
        ? process.getgroups().map(String)
        : []
}

module.exports = {
    NormalizeMounts,
    NormalizeMount,
    NormalizePorts,
    ResolveGroupAdd,
    TIPOS_DE_MONTAGEM,
    PROTOCOLOS
}
