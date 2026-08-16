/*
    Tradução de um ENDPOINT declarado pelo usuário para as opções de conexão do
    cliente do runtime (CTMG-8).

    Docker e Podman falam a mesma API HTTP, e o endereço dela pode chegar de
    três formas: um socket unix local, um host TCP, ou uma URL http/https. Quem
    cadastra a conexão escreve uma string só — `unix:///var/run/docker.sock`,
    `tcp://10.0.0.5:2375` — e é aqui que ela vira configuração.

    Função PURA, em arquivo próprio, pela mesma razão de ResolveVolumeEntryPath:
    a regra que decide COM QUEM o adaptador vai falar precisa ser verificável
    sem nenhum runtime instalado.

    A REGRA: endpoint malformado é RECUSADO, nunca completado por adivinhação.
    Um host sem esquema poderia ser TCP simples ou TLS; escolher por conta
    própria significaria conectar em texto claro onde o usuário queria TLS.
*/

import type {
    RuntimeClientOptions,
    RuntimeConnectionResolution,
    TLSMaterial
} from "../Managers/Types"

const TCP_PORT_PADRAO = 2375
const TLS_PORT_PADRAO = 2376

const RUNTIME_TYPES = ["docker", "podman"]

const ResolveRuntimeConnection = (
    endpoint: unknown,
    { tls }: { tls?: TLSMaterial } = {}
): RuntimeConnectionResolution => {
    const bruto = typeof endpoint === "string" ? endpoint.trim() : ""

    if (bruto === "") {
        return { valid: false, reason: "ENDPOINT_REQUIRED" }
    }
    if (bruto.includes("\0")) {
        return { valid: false, reason: "INVALID_ENDPOINT" }
    }

    const separador = bruto.indexOf("://")
    if (separador < 1) {
        return { valid: false, reason: "SCHEME_REQUIRED" }
    }

    const esquema = bruto.slice(0, separador).toLowerCase()
    const resto = bruto.slice(separador + 3)

    if (esquema === "unix") {
        if (!resto.startsWith("/")) {
            return { valid: false, reason: "SOCKET_PATH_MUST_BE_ABSOLUTE" }
        }
        return {
            valid: true,
            transport: "unix",
            socketPath: resto,
            clientOptions: { socketPath: resto }
        }
    }

    if (esquema === "tcp" || esquema === "http" || esquema === "https") {
        const seguro = esquema === "https" || Boolean(tls)
        const [autoridade] = resto.split("/")
        const ultimoDoisPontos = autoridade.lastIndexOf(":")
        const host = ultimoDoisPontos > 0 ? autoridade.slice(0, ultimoDoisPontos) : autoridade
        const portaTexto = ultimoDoisPontos > 0 ? autoridade.slice(ultimoDoisPontos + 1) : ""

        if (host === "") {
            return { valid: false, reason: "HOST_REQUIRED" }
        }

        let porta: number
        if (portaTexto === "") {
            porta = seguro ? TLS_PORT_PADRAO : TCP_PORT_PADRAO
        } else {
            if (!/^\d+$/.test(portaTexto)) {
                return { valid: false, reason: "INVALID_PORT" }
            }
            porta = Number(portaTexto)
            if (porta < 1 || porta > 65535) {
                return { valid: false, reason: "INVALID_PORT" }
            }
        }

        const clientOptions: RuntimeClientOptions = {
            host,
            port: porta,
            protocol: seguro ? "https" : "http"
        }

        // O material de TLS vai adiante como veio: validar certificado é
        // trabalho da camada TLS, não de um parser de string.
        if (tls) {
            if (tls.ca) clientOptions.ca = tls.ca
            if (tls.cert) clientOptions.cert = tls.cert
            if (tls.key) clientOptions.key = tls.key
        }

        return {
            valid: true,
            transport: "tcp",
            host,
            port: porta,
            secure: seguro,
            clientOptions
        }
    }

    return { valid: false, reason: "UNSUPPORTED_SCHEME" }
}

const IsSupportedRuntimeType = (runtimeType: unknown): boolean =>
    RUNTIME_TYPES.includes(String(runtimeType || "").toLowerCase())

module.exports = {
    ResolveRuntimeConnection,
    IsSupportedRuntimeType,
    RUNTIME_TYPES,
    TCP_PORT_PADRAO,
    TLS_PORT_PADRAO
}
