/*
    Opções de criação de rede, validadas (CTMG-49).

    A tela de redes oferece hoje nome e driver. A API aceita muito mais — e a
    parte que interessa a quem opera de verdade é o IPAM: sub-rede, faixa de
    alocação e gateway.

    POR QUE VALIDAR AQUI, E NÃO DEIXAR O DAEMON RECLAMAR

    O daemon recusa CIDR malformado, mas aceita sem piscar um gateway FORA da
    sub-rede declarada. A rede nasce, os containers sobem, e a saída para fora
    simplesmente não funciona — com um sintoma ("não tenho internet") que não
    aponta para a causa. É o tipo de configuração errada que custa uma tarde.

    Função pura: a aritmética de rede toda é verificável sem runtime.
*/

import type { OperationError } from "../Operations/Types"

/*
    O IPAM como o usuário o escreve: uma sub-rede, uma faixa e um gateway em
    texto. Chegam como `unknown` porque a validação abaixo é justamente quem
    decide se aquilo é um CIDR — declará-los `string` faria a checagem de
    formato parecer redundante.
*/
type IpamConfigInput = {
    subnet?: unknown
    ipRange?: unknown
    gateway?: unknown
    auxAddress?: unknown
    auxiliaryAddresses?: unknown
}

/*
    As opções de criação de rede. O índice por texto existe por causa da
    checagem de campo FORA DE LUGAR: ela procura `subnet`, `gateway` e afins na
    RAIZ, que é onde eles não deveriam estar.
*/
type NetworkOptionsInput = {
    name?: unknown
    driver?: unknown
    internal?: unknown
    attachable?: unknown
    ingress?: unknown
    enableIPv6?: unknown
    ipam?: any
    options?: Record<string, unknown>
    labels?: Record<string, unknown>
    checkDuplicate?: unknown
    [campo: string]: unknown
}

const CriarErro = (mensagem: string, campo?: string): OperationError => {
    const erro: OperationError = new Error(mensagem)
    erro.code = "INVALID_NETWORK_OPTIONS"
    erro.httpStatus = 400
    erro.statusCode = 400
    if (campo) erro.field = campo
    return erro
}

const EhIPv6 = (texto: unknown) => String(texto).includes(":")

/* ------------------------------------------------------------------- IPv4 */

const IPv4ParaNumero = (ip: unknown, campo?: string): number => {
    const partes = String(ip).split(".")
    if (partes.length !== 4) throw CriarErro(`Endereço IPv4 inválido: ${ip}`, campo)

    return partes.reduce((total, parte) => {
        if (!/^\d{1,3}$/.test(parte)) throw CriarErro(`Endereço IPv4 inválido: ${ip}`, campo)
        const octeto = Number(parte)
        if (octeto > 255) throw CriarErro(`Endereço IPv4 inválido: ${ip}`, campo)
        return (total << 8 >>> 0) + octeto
    }, 0) >>> 0
}

const InterpretarCidrIPv4 = (cidr: unknown, campo?: string) => {
    const [endereco, prefixoTexto] = String(cidr).split("/")
    if (prefixoTexto === undefined) {
        throw CriarErro(`Informe a máscara, ex.: 172.20.0.0/16 (recebido: ${cidr})`, campo)
    }

    const prefixo = Number(prefixoTexto)
    if (!Number.isInteger(prefixo) || prefixo < 0 || prefixo > 32) {
        throw CriarErro(`Máscara IPv4 inválida em ${cidr}`, campo)
    }

    const base = IPv4ParaNumero(endereco, campo)
    const mascara = prefixo === 0 ? 0 : (0xffffffff << (32 - prefixo)) >>> 0

    return {
        primeiro: (base & mascara) >>> 0,
        ultimo: ((base & mascara) | (~mascara >>> 0)) >>> 0,
        prefixo
    }
}

const ContidoNaSubrede = (ip: unknown, cidr: unknown, campo?: string): boolean => {
    // Contenção de IPv6 exigiria aritmética de 128 bits; a validação forte
    // fica no IPv4, que é o caso de 99% das redes locais. Em IPv6 o formato é
    // conferido pelo daemon.
    if (EhIPv6(ip) || EhIPv6(cidr)) return true

    const faixa = InterpretarCidrIPv4(cidr, campo)
    const numero = IPv4ParaNumero(ip, campo)
    return numero >= faixa.primeiro && numero <= faixa.ultimo
}

/* -------------------------------------------------------------------- IPAM */

const BuildIpamConfig = (config: IpamConfigInput | null | undefined, indice: number) => {
    const prefixoCampo = `ipam.config[${indice}]`
    const { subnet, ipRange, gateway, auxAddress, auxiliaryAddresses } = config ?? {}

    if (!subnet) {
        throw CriarErro("Configuração de IPAM sem sub-rede.", `${prefixoCampo}.subnet`)
    }

    // Valida o formato lançando cedo, com o campo nomeado.
    if (!EhIPv6(subnet)) InterpretarCidrIPv4(subnet, `${prefixoCampo}.subnet`)

    if (ipRange && !EhIPv6(subnet)) {
        const faixa = InterpretarCidrIPv4(ipRange, `${prefixoCampo}.ipRange`)
        const rede = InterpretarCidrIPv4(subnet, `${prefixoCampo}.subnet`)

        if (faixa.primeiro < rede.primeiro || faixa.ultimo > rede.ultimo) {
            throw CriarErro(
                `A faixa ${ipRange} não cabe dentro da sub-rede ${subnet}.`,
                `${prefixoCampo}.ipRange`
            )
        }
    }

    if (gateway && !ContidoNaSubrede(gateway, subnet, `${prefixoCampo}.gateway`)) {
        throw CriarErro(
            `O gateway ${gateway} está fora da sub-rede ${subnet}. ` +
            "O daemon aceitaria isto e a rede não teria saída.",
            `${prefixoCampo}.gateway`
        )
    }

    return {
        Subnet: subnet,
        ...(ipRange ? { IPRange: ipRange } : {}),
        ...(gateway ? { Gateway: gateway } : {}),
        ...(auxAddress || auxiliaryAddresses
            ? { AuxiliaryAddresses: auxAddress || auxiliaryAddresses }
            : {})
    }
}

const NormalizarRotulos = (labels?: Record<string, unknown> | null) =>
    Object.fromEntries(
        Object.entries(labels ?? {}).map(([chave, valor]) => [chave, valor == null ? "" : String(valor)])
    )

const BuildNetworkOptions = (options: NetworkOptionsInput = {}) => {
    const {
        name,
        driver,
        internal,
        attachable,
        ingress,
        enableIPv6,
        ipam,
        options: driverOptions,
        labels,
        checkDuplicate
    } = options

    if (typeof name !== "string" || name.trim() === "") {
        throw CriarErro("Informe o nome da rede.", "name")
    }

    /*
        SUB-REDE NO LUGAR ERRADO É O ERRO MAIS FÁCIL DE COMETER AQUI.

        `{ name, subnet: "172.31.0.0/24" }` parece óbvio e é ignorado: o IPAM
        do Docker mora em `ipam.config[]`. Sem esta checagem a rede NASCE — com
        a sub-rede que o daemon escolher — e o erro só aparece quando alguém
        estranha o IP do container, muito depois.

        Recusar é a única resposta honesta: aceitar em silêncio faz o app
        prometer uma configuração que não aplicou.
    */
    const FORA_DE_LUGAR = ["subnet", "gateway", "ipRange", "auxAddress", "auxiliaryAddresses"]
    const perdido = FORA_DE_LUGAR.find((campo) => options[campo] !== undefined)
    if (perdido) {
        throw CriarErro(
            `O campo "${perdido}" não vive na raiz: ele pertence a ipam.config[]. ` +
            `Use { ipam: { config: [{ ${perdido}: ... }] } } — na raiz ele seria ` +
            "ignorado em silêncio e a rede nasceria com a faixa que o daemon escolhesse.",
            perdido
        )
    }

    const configuracoes = (ipam?.config ?? ipam?.Config ?? []).map(BuildIpamConfig)

    return {
        Name: name.trim(),
        ...(driver ? { Driver: String(driver) } : {}),
        ...(internal !== undefined ? { Internal: Boolean(internal) } : {}),
        ...(attachable !== undefined ? { Attachable: Boolean(attachable) } : {}),
        ...(ingress !== undefined ? { Ingress: Boolean(ingress) } : {}),
        ...(enableIPv6 !== undefined ? { EnableIPv6: Boolean(enableIPv6) } : {}),
        ...(checkDuplicate !== undefined ? { CheckDuplicate: Boolean(checkDuplicate) } : {}),
        ...(configuracoes.length > 0 || ipam?.driver || ipam?.options
            ? {
                IPAM: {
                    ...(ipam?.driver ? { Driver: String(ipam.driver) } : {}),
                    ...(configuracoes.length > 0 ? { Config: configuracoes } : {}),
                    ...(ipam?.options ? { Options: ipam.options } : {})
                }
            }
            : {}),
        ...(driverOptions ? { Options: driverOptions } : {}),
        ...(labels ? { Labels: NormalizarRotulos(labels) } : {})
    }
}

module.exports = BuildNetworkOptions
module.exports.ContidoNaSubrede = ContidoNaSubrede
module.exports.InterpretarCidrIPv4 = InterpretarCidrIPv4
