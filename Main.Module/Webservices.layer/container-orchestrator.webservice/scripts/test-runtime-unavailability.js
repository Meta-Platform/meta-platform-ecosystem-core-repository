/*
    Adapter fora do ar precisa virar MENSAGEM, não "status code 500" (VDRP-218).

    O que o operador via na aba Containers era exatamente isso: `Request failed
    with status code 500`. A causa real — socket do container-runtime-adapter
    sem ninguém escutando do outro lado — não aparecia em lugar nenhum da tela,
    e o estado do serviço continuava dizendo RUNNING/ACTIVE.

    O que estas asserções protegem:
    - falha de socket (em qualquer das formas que o Node reporta) vira um erro
      tipado, com 503 e texto que diz o que fazer;
    - erro que NÃO é de socket passa intacto — traduzir tudo mascararia bug de
      verdade como "adapter indisponível", que é pior que o 500 original;
    - a mensagem não vaza caminho de socket do host (o painel roda para o
      operador, mas caminho de host é superfície que VDRP-194 tirou das
      respostas).

    Uso:  node scripts/test-runtime-unavailability.js
*/
const RequireSource = require("./RequireSource")

const {
    TranslateRuntimeUnavailability,
    ContainerRuntimeUnavailableError
} = RequireSource("Controllers/ContainerOrchestrator.controller")

let failures = 0
const ok = (cond, msg) => {
    console.log(`${cond ? "  OK   " : "  FALHA"} ${msg}`)
    if (!cond) failures++
}

console.log("\nFALHA DE SOCKET VIRA ERRO TIPADO")
for (const code of ["ECONNREFUSED", "ENOENT", "EACCES", "ECONNRESET", "EPIPE"]) {
    const original = Object.assign(new Error(`connect ${code} /mnt/sockets/container-runtime-socket/socket.sock`), { code })
    const traduzido = TranslateRuntimeUnavailability(original)
    ok(traduzido instanceof ContainerRuntimeUnavailableError, `${code} vira ContainerRuntimeUnavailableError`)
    ok(traduzido.statusCode === 503, `${code} responde 503 (indisponível), não 500 (erro nosso)`)
}

console.log("\nQUANDO O CÓDIGO VEM SÓ NO TEXTO (erro já serializado por outra camada)")
{
    const semCode = new Error("Error: connect ECONNREFUSED /mnt/sockets/container-runtime-socket/socket.sock")
    ok(TranslateRuntimeUnavailability(semCode) instanceof ContainerRuntimeUnavailableError,
        "erro sem `code`, mas com o motivo no texto, também é reconhecido")
}

console.log("\nO QUE NÃO É FALHA DE SOCKET PASSA INTACTO")
{
    const negocio = new Error("Container já está em execução")
    ok(TranslateRuntimeUnavailability(negocio) === negocio,
        "erro de negócio chega ao operador como veio — traduzir tudo esconderia bug de verdade")

    const semNada = TranslateRuntimeUnavailability(undefined)
    ok(semNada === undefined, "undefined não é convertido em indisponibilidade")
}

console.log("\nA MENSAGEM AJUDA E NÃO VAZA CAMINHO DE HOST")
{
    const traduzido = TranslateRuntimeUnavailability(
        Object.assign(new Error("connect ECONNREFUSED /home/kadisk/EcosystemData/sockets/x.sock"), { code: "ECONNREFUSED" }))
    ok(/re-provisionar|reiniciar/i.test(traduzido.message), "a mensagem diz o que fazer")
    ok(!traduzido.message.includes("/home/kadisk"), "a mensagem não repete caminho do host")
}

console.log(`\n${failures === 0 ? "TODOS OS CRITÉRIOS PASSARAM" : `HOUVE ${failures} FALHA(S)`}`)
process.exit(failures === 0 ? 0 : 1)
