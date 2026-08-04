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

const CriarErro = (mensagem, campo) => {
    const erro = new Error(mensagem)
    erro.code = "INVALID_NETWORK_OPTIONS"
    erro.httpStatus = 400
    erro.statusCode = 400
    if (campo) erro.field = campo
    return erro
}

const EhIPv6 = (texto) => String(texto).includes(":")

/* ------------------------------------------------------------------- IPv4 */

const IPv4ParaNumero = (ip, campo) => {
    const partes = String(ip).split(".")
    if (partes.length !== 4) throw CriarErro(`Endereço IPv4 inválido: ${ip}`, campo)

    return partes.reduce((total, parte) => {
        if (!/^\d{1,3}$/.test(parte)) throw CriarErro(`Endereço IPv4 inválido: ${ip}`, campo)
        const octeto = Number(parte)
        if (octeto > 255) throw CriarErro(`Endereço IPv4 inválido: ${ip}`, campo)
        return (total << 8 >>> 0) + octeto
    }, 0) >>> 0
}

const InterpretarCidrIPv4 = (cidr, campo) => {
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

const ContidoNaSubrede = (ip, cidr, campo) => {
    // Contenção de IPv6 exigiria aritmética de 128 bits; a validação forte
    // fica no IPv4, que é o caso de 99% das redes locais. Em IPv6 o formato é
    // conferido pelo daemon.
    if (EhIPv6(ip) || EhIPv6(cidr)) return true

    const faixa = InterpretarCidrIPv4(cidr, campo)
    const numero = IPv4ParaNumero(ip, campo)
    return numero >= faixa.primeiro && numero <= faixa.ultimo
}

/* -------------------------------------------------------------------- IPAM */

const BuildIpamConfig = (config, indice) => {
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

const NormalizarRotulos = (labels) =>
    Object.fromEntries(
        Object.entries(labels ?? {}).map(([chave, valor]) => [chave, valor == null ? "" : String(valor)])
    )

const BuildNetworkOptions = (options = {}) => {
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
