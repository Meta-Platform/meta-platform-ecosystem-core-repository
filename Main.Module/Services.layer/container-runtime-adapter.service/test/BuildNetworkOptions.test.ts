/*
    As opções de rede, que são puras e por isso conferíveis sem daemon.

    O que estes casos protegem não é o formato — é o SILÊNCIO. As duas
    configurações erradas que o Docker aceita sem reclamar (gateway fora da
    sub-rede, e IPAM escrito na raiz) produzem uma rede que existe e não
    funciona, com um sintoma que não aponta para a causa.
*/

const test = require("node:test")
const assert = require("node:assert")

const BuildNetworkOptions = require("../src/Helpers/BuildNetworkOptions")

test("o mínimo vira o Name do Docker", () => {
    assert.deepStrictEqual(BuildNetworkOptions({ name: "minha-rede" }), { Name: "minha-rede" })
})

test("nome vazio é recusado com o campo nomeado", () => {
    assert.throws(() => BuildNetworkOptions({ name: "  " }), (erro) => {
        assert.strictEqual(erro.code, "INVALID_NETWORK_OPTIONS")
        assert.strictEqual(erro.field, "name")
        return true
    })
})

test("o IPAM completo é traduzido para a forma do Docker", () => {
    const opcoes = BuildNetworkOptions({
        name: "rede",
        driver: "bridge",
        internal: true,
        ipam: {
            driver: "default",
            config: [{ subnet: "172.31.77.0/24", gateway: "172.31.77.1", ipRange: "172.31.77.128/25" }]
        },
        labels: { time: "plataforma", numero: 7 }
    })

    assert.strictEqual(opcoes.Name, "rede")
    assert.strictEqual(opcoes.Internal, true)
    assert.deepStrictEqual(opcoes.IPAM.Config, [{
        Subnet: "172.31.77.0/24",
        IPRange: "172.31.77.128/25",
        Gateway: "172.31.77.1"
    }])
    // O Docker exige Labels do tipo map[string]string.
    assert.deepStrictEqual(opcoes.Labels, { time: "plataforma", numero: "7" })
})

test("gateway fora da sub-rede é recusado — o daemon aceitaria", () => {
    assert.throws(
        () => BuildNetworkOptions({
            name: "rede",
            ipam: { config: [{ subnet: "172.31.77.0/24", gateway: "10.0.0.1" }] }
        }),
        (erro) => {
            assert.strictEqual(erro.field, "ipam.config[0].gateway")
            assert.match(erro.message, /fora da sub-rede/)
            return true
        })
})

test("faixa que não cabe na sub-rede é recusada", () => {
    assert.throws(
        () => BuildNetworkOptions({
            name: "rede",
            ipam: { config: [{ subnet: "172.31.77.0/24", ipRange: "172.31.78.0/24" }] }
        }),
        (erro) => {
            assert.strictEqual(erro.field, "ipam.config[0].ipRange")
            return true
        })
})

/*
    Este é o caso que a verificação contra Docker real descobriu: a chamada
    passava `subnet` na raiz, a função ignorava, e a rede nascia com a faixa
    172.21.0.0 escolhida pelo daemon em vez da pedida.
*/
test("sub-rede escrita na RAIZ é recusada, e a mensagem diz onde ela mora", () => {
    assert.throws(
        () => BuildNetworkOptions({ name: "rede", subnet: "172.31.77.0/24" }),
        (erro) => {
            assert.strictEqual(erro.field, "subnet")
            assert.match(erro.message, /ipam\.config/)
            return true
        })
})

test("gateway na raiz também é recusado", () => {
    assert.throws(
        () => BuildNetworkOptions({ name: "rede", gateway: "172.31.77.1" }),
        (erro) => erro.field === "gateway")
})
