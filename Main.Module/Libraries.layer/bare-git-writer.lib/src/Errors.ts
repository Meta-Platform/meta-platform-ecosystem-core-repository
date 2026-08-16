/*
    Erros da escrita em repositório bare.

    Cada um carrega `code` e `statusCode` porque quem chama é, na prática, um
    controller HTTP: sem o status o servidor devolve 500 para tudo, e "alguém
    commitou antes de você" fica indistinguível de "o git quebrou". `httpStatus`
    existe junto de `statusCode` porque as duas grafias são lidas em pontos
    diferentes do ecossistema.

    A lib NÃO sabe nada de IAM, de dono do repositório nem de banco — 401/403/404
    de posse são decisão de quem a consome. Aqui só existem as recusas que
    dependem do estado do git.
*/

class BareGitWriteError extends Error {

    // Declarados porque são atribuídos aqui e LIDOS lá fora — pelo controller
    // HTTP, que decide o status da resposta a partir deles.
    code: string
    statusCode: number
    httpStatus: number
    stderr?: string

    constructor(message: string, { name, code, statusCode, ...rest }: {
        name: string
        code: string
        statusCode: number
        [field: string]: unknown
    }) {
        super(message)
        this.name = name
        this.code = code
        this.statusCode = statusCode
        this.httpStatus = statusCode
        Object.assign(this, rest)
    }
}

/*
    Change set que não pode nem ser tentado: caminho fora do repositório, modo
    não permitido, arquivo grande demais, duplicata. Recusa ANTES de tocar em
    git, para que um pedido inválido nunca deixe objeto solto atrás.
*/
class InvalidChangeError extends BareGitWriteError {
    constructor(message: string, code = "INVALID_CHANGE") {
        super(message, { name: "InvalidChangeError", code, statusCode: 400 })
    }
}

/*
    O branch tem história e o chamador não disse sobre qual commit editou.

    Isto é recusa, e não conveniência: aplicar um change set sem saber de onde
    ele partiu sobrescreve, calado, o que entrou no meio — e o autor da perda
    nunca fica sabendo que perdeu. Quem realmente quer escrever às cegas manda
    `requireHeadAssertion: false` e assume.
*/
class HeadAssertionRequiredError extends BareGitWriteError {
    constructor(currentHeadOid?: string) {
        super("Informe sobre qual commit estas mudanças foram feitas.",
            { name: "HeadAssertionRequiredError", code: "HEAD_ASSERTION_REQUIRED", statusCode: 400, currentHeadOid })
    }
}

/*
    A ponta do branch não é mais a que o chamador leu. `conflictingPaths` é o
    que a tela precisa para dizer QUAL arquivo recarregar em vez de mandar
    recomeçar tudo.
*/
class StaleHeadError extends BareGitWriteError {
    constructor({ expectedHeadOid, currentHeadOid, conflictingPaths = [] }: {
        expectedHeadOid?: string
        currentHeadOid?: string
        conflictingPaths?: string[]
    }) {
        super("Este branch avançou desde a última leitura.",
            { name: "StaleHeadError", code: "STALE_HEAD", statusCode: 409, expectedHeadOid, currentHeadOid, conflictingPaths })
    }
}

/*
    Um arquivo específico do change set não está mais no estado que o chamador
    leu (ou passou a existir, quando ele afirmou que não existia). Separado de
    STALE_HEAD porque a resolução é outra: aqui não há o que reaplicar
    automaticamente, o conteúdo precisa ser reconciliado.
*/
class FileChangedError extends BareGitWriteError {
    constructor(conflicts: unknown) {
        super("O conteúdo de um arquivo mudou desde a última leitura.",
            { name: "FileChangedError", code: "FILE_CHANGED", statusCode: 409, conflicts })
    }
}

/*
    A árvore resultante é idêntica à do commit atual. Commit vazio não é erro do
    git (ele aceita), mas é sempre sintoma: ou a tela mandou salvar sem mudança,
    ou o change set foi calculado errado. Registrar isso como commit polui o
    histórico com algo que não aconteceu.
*/
class EmptyCommitError extends BareGitWriteError {
    constructor(headOid?: string) {
        super("Nada mudou em relação ao commit atual.",
            { name: "EmptyCommitError", code: "EMPTY_COMMIT", statusCode: 409, headOid })
    }
}

/*
    O git não pôde ser executado, ou falhou onde deveria funcionar. 503 e não
    500: é indisponibilidade da instalação, não defeito do pedido.
*/
class GitRuntimeError extends BareGitWriteError {
    constructor(message: string, { stderr, cause }: { stderr?: string, cause?: unknown } = {}) {
        super(message, { name: "GitRuntimeError", code: "GIT_RUNTIME_ERROR", statusCode: 503, stderr })
        this.cause = cause
    }
}

module.exports = {
    BareGitWriteError,
    InvalidChangeError,
    HeadAssertionRequiredError,
    StaleHeadError,
    FileChangedError,
    EmptyCommitError,
    GitRuntimeError
}
