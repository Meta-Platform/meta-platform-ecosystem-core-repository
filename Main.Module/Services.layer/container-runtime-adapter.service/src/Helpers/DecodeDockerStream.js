/*
    Decodificador do fluxo binário do runtime (CTMG-21).

    O runtime entrega a saída de um container de duas formas, e quem lê não
    escolhe qual:

    - **multiplexada**: quadros de 8 bytes — `[tipo][0][0][0][tamanho:4 BE]` —
      seguidos do payload. É o formato quando não há TTY.
    - **crua**: os bytes do terminal, sem enquadramento, quando há TTY.

    A teoria diz que basta olhar o `Tty` do exec para saber qual esperar. A
    prática não: uma sessão aberta com `Tty: true` num container criado sem TTY
    veio enquadrada mesmo assim, e o resultado foi lixo binário no meio do
    texto do terminal (verificado contra o Docker 29.6.2).

    Por isso este decodificador não pergunta, ele OBSERVA: se o começo do
    pedaço tem cara de quadro, desenquadra; se não tem, deixa passar. Sem
    corrigir silenciosamente nada — no modo cru, o byte que chegou é o byte que
    sai.

    Função pura sobre um acumulador próprio: dá para verificar inteira sem
    runtime nenhum.
*/

const TIPOS_DE_FLUXO = {
    0: "stdin",
    1: "stdout",
    2: "stderr"
}

const PareceQuadro = (buffer) =>
    buffer.length >= 8
    && (buffer[0] === 0 || buffer[0] === 1 || buffer[0] === 2)
    && buffer[1] === 0
    && buffer[2] === 0
    && buffer[3] === 0

const CreateDockerStreamDecoder = ({ onData }) => {

    let acumulado = Buffer.alloc(0)

    const Emitir = (fluxo, dados) => {
        if (dados.length === 0) return
        onData && onData({ stream: fluxo, data: dados.toString("utf-8") })
    }

    const Push = (pedaco) => {
        const entrada = Buffer.isBuffer(pedaco) ? pedaco : Buffer.from(String(pedaco), "utf-8")
        acumulado = acumulado.length === 0 ? entrada : Buffer.concat([acumulado, entrada])

        while (acumulado.length > 0) {
            if (!PareceQuadro(acumulado)) {
                /*
                    Sem cara de quadro. Pode ser fluxo cru (TTY) ou um quadro
                    partido no meio do cabeçalho: só espera se houver menos de
                    8 bytes E o primeiro byte for um tipo válido — caso
                    contrário, o texto sairia preso esperando um quadro que
                    nunca vem.
                */
                const podeSerCabecalhoIncompleto =
                    acumulado.length < 8
                    && (acumulado[0] === 0 || acumulado[0] === 1 || acumulado[0] === 2)
                    && acumulado.slice(1).every((byte) => byte === 0)

                if (podeSerCabecalhoIncompleto) return

                Emitir("stdout", acumulado)
                acumulado = Buffer.alloc(0)
                return
            }

            const tipo = TIPOS_DE_FLUXO[acumulado[0]] || "stdout"
            const tamanho = acumulado.readUInt32BE(4)
            const fim = 8 + tamanho

            // Quadro anunciado mas ainda incompleto: espera o resto.
            if (acumulado.length < fim) return

            Emitir(tipo, acumulado.slice(8, fim))
            acumulado = acumulado.slice(fim)
        }
    }

    // O que sobrou quando o fluxo termina: melhor entregar do que engolir.
    const Flush = () => {
        if (acumulado.length === 0) return
        Emitir("stdout", acumulado)
        acumulado = Buffer.alloc(0)
    }

    return { Push, Flush }
}

module.exports = CreateDockerStreamDecoder
module.exports.PareceQuadro = PareceQuadro
