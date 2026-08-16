/*
    Descoberta dos runtimes de container instalados na máquina (CTMG-10).

    Cadastrar uma conexão sabendo de cor o caminho do socket é conhecimento que
    só quem já apanhou tem: o socket do Docker fica em /var/run, o do Podman
    rootless fica sob o runtime dir do usuário, e o do Podman de sistema em
    outro lugar ainda. Esta função varre os lugares conhecidos e devolve o que
    EXISTE, para a interface oferecer em vez de perguntar.

    Recebe `fileExists`, `env` e `uid` por parâmetro em vez de tocar `fs` e
    `process` direto: assim a lista de candidatos é testável sem depender da
    máquina onde o teste roda.

    Descoberta é SUGESTÃO, não conexão: o socket existir não prova que alguém
    escuta do outro lado. Quem confirma isso é o Probe do ConnectionManager.
*/

import type { RuntimeSuggestion } from "../Managers/Types"

const { existsSync } = require("node:fs") as typeof import("node:fs")

/*
    Um lugar conhecido onde um runtime costuma escutar. `Path` recebe o
    ambiente e o uid em vez de lê-los por conta própria — é o que torna a lista
    verificável sem depender da máquina onde o teste roda.
*/
type CandidatoDeRuntime = {
    runtimeType: string
    suggestedName: string
    description: string
    Path: (contexto: { env: NodeJS.ProcessEnv, uid: number | null }) => string | null
}

const CANDIDATOS: CandidatoDeRuntime[] = [
    {
        runtimeType: "docker",
        suggestedName: "docker-local",
        description: "Docker Engine do sistema",
        Path: () => "/var/run/docker.sock"
    },
    {
        runtimeType: "podman",
        suggestedName: "podman-usuario",
        description: "Podman rootless do usuário atual",
        Path: ({ env, uid }) => {
            const runtimeDir = env.XDG_RUNTIME_DIR
            if (runtimeDir) return `${runtimeDir}/podman/podman.sock`
            if (uid === undefined || uid === null) return null
            return `/run/user/${uid}/podman/podman.sock`
        }
    },
    {
        runtimeType: "podman",
        suggestedName: "podman-sistema",
        description: "Podman de sistema (root)",
        Path: () => "/run/podman/podman.sock"
    }
]

/*
    DOCKER_HOST é a variável que ferramentas de linha de comando respeitam.
    Quem a definiu já disse com quem quer falar — a sugestão sai dela, não de
    um caminho no disco.
*/
const FromEnvironment = (env: NodeJS.ProcessEnv): RuntimeSuggestion[] => {
    const dockerHost = typeof env.DOCKER_HOST === "string" ? env.DOCKER_HOST.trim() : ""
    if (dockerHost === "") return []
    return [{
        runtimeType: dockerHost.includes("podman") ? "podman" : "docker",
        suggestedName: "docker-host-env",
        description: "Endereço declarado em DOCKER_HOST",
        endpoint: dockerHost,
        source: "environment"
    }]
}

const DiscoverLocalRuntimes = ({
    fileExists = existsSync,
    env = process.env,
    uid = typeof process.getuid === "function" ? process.getuid() : null
}: {
    fileExists?: (caminho: string) => boolean
    env?: NodeJS.ProcessEnv
    uid?: number | null
} = {}): RuntimeSuggestion[] => {
    const doAmbiente = FromEnvironment(env)

    const doDisco = CANDIDATOS
        .map((candidato) => {
            const caminho = candidato.Path({ env, uid })
            if (!caminho) return null
            if (!fileExists(caminho)) return null
            return {
                runtimeType: candidato.runtimeType,
                suggestedName: candidato.suggestedName,
                description: candidato.description,
                endpoint: `unix://${caminho}`,
                source: "filesystem"
            }
        })
        .filter(Boolean) as RuntimeSuggestion[]

    // Sem duplicar o mesmo endereço quando DOCKER_HOST aponta para um socket
    // que também foi encontrado no disco.
    const vistos = new Set<string>()
    return [...doAmbiente, ...doDisco].filter((sugestao) => {
        if (vistos.has(sugestao.endpoint)) return false
        vistos.add(sugestao.endpoint)
        return true
    })
}

module.exports = DiscoverLocalRuntimes
