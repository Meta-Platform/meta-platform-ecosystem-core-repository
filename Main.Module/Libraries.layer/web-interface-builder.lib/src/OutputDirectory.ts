const crypto = require("crypto") as typeof import("crypto")
const { join } = require("path") as typeof import("path")

// Onde o build de um `.webgui` é montado, e como esse diretório é NOMEADO.
//
// Esta lib e o `endpoint-instance.taskLoader` (que a consome via injeção —
// nenhum dos dois pode `require` relativo até o outro) precisam concordar
// byte a byte no nome, senão um lado escreve num diretório que o outro nunca
// procura. Por isso a conta mora aqui, uma vez só, e viaja pelo mesmo canal
// que `BuildProfiles` já usa: pendurada na função `WebInterfaceBuilder`
// devolvida pela fábrica (ver o fim de `WebInterfaceBuilder.ts`).
//
// O hash é uma cópia PROPOSITAL do `ComputeObjectHash` do essential (mesmo
// algoritmo: sha256 de JSON.stringify), e não uma dependência injetada dele.
// Esta lib e o `PrebuildWebInterface.ts` (o caminho de pré-build, que roda
// FORA de qualquer ecossistema instalado) precisam do mesmo cálculo sem
// depender de `runtimeDeps` — só a implementação local garante isso.
const _ComputeObjectHash = (object: unknown): string => {
    const hash = crypto.createHash("sha256")
    hash.update(JSON.stringify(object))
    return hash.digest("hex")
}

const DIR_SUFFIX = "webInterfaceAssets"

// Nome do diretório de saída. PORTÁVEL de propósito: entram só dados que
// descrevem O QUE está sendo construído — app, entrada, template, perfil,
// motor —, nunca ONDE a máquina que constrói guarda as coisas.
//
// Até esta versão o hash também incluía `context`, `environmentPath` e
// `nodeModulesPath` — todos caminhos ABSOLUTOS do host. Um artefato
// construído numa máquina (ou numa etapa de imagem) nunca era achado por
// outra: o nome do diretório nascia amarrado ao checkout que compilou.
//
// Mudar isto tem um efeito colateral aceito: um build anterior, gravado sob o
// hash ANTIGO, deixa de ser encontrado pelo nome novo — ele fica órfão (a
// faxina de `PurgeStaleWebInterfaceAssets` eventualmente o remove) e o
// primeiro build depois desta mudança acontece de novo, uma vez. Dali em
// diante o mesmo pacote, em qualquer máquina, aponta para o mesmo diretório —
// que é exatamente o que permite construir num lugar e servir noutro.
//
// Qualquer campo extra que o chamador passe (por engano ou por reuso de um
// objeto maior, como o `loaderParams` inteiro) é ignorado: só os cinco
// campos abaixo entram no hash.
const ComputeOutputDirName = ({
    serverAppName,
    entrypoint,
    htmlTemplate,
    profileKey,
    buildEngine
}: {
    serverAppName?: string
    entrypoint?: string
    htmlTemplate?: string
    profileKey?: string
    buildEngine?: string
}): string =>
    _ComputeObjectHash({ serverAppName, entrypoint, htmlTemplate, profileKey, buildEngine })

const MountOutputDirPath = ({ environmentPath, outputDirName, generatedDirName }: {
    environmentPath: string
    outputDirName: string
    generatedDirName: string
}) =>
    join(environmentPath, generatedDirName, `${outputDirName}.${DIR_SUFFIX}`)

module.exports = { DIR_SUFFIX, ComputeOutputDirName, MountOutputDirPath }
