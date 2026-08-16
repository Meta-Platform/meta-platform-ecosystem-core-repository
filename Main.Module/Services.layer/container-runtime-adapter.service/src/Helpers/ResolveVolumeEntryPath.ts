/*
    Contenção de caminho dentro de um volume (VDRP-260).

    Este é o último ponto antes do sistema de arquivos real: o que passar daqui
    vira caminho montado num container com o volume do usuário. Um ".." que
    escape transforma "escrever no meu espaço" em "escrever em qualquer lugar
    que o container enxergue".

    Função PURA e em arquivo próprio de propósito — a mesma disciplina de
    ResolveObjectStoragePath.js (MyData) e ResolveVersionArchivePath.js (RVC):
    a regra que protege o disco não pode depender de Docker para ser
    verificada. Assim ela é testável sem socket, sem imagem e sem container
    (scripts/test-volume-files.js).

    A REGRA: caminho é sempre RELATIVO à raiz do volume. Absoluto, com "..",
    ou com byte nulo é recusado — nunca "corrigido". Corrigir silenciosamente
    faria a operação acontecer num lugar diferente do que o chamador pediu, que
    é a pior resposta possível para uma escrita.
*/

import type { VolumeEntryPathResolution } from "../Operations/Types"

const VOLUME_MOUNT_PATH = "/data"

const ResolveVolumeEntryPath = (
    relativePath: unknown,
    { mountPath = VOLUME_MOUNT_PATH }: { mountPath?: string } = {}
): VolumeEntryPathResolution => {
    const bruto = typeof relativePath === "string" ? relativePath.trim() : ""

    if (bruto === "" || bruto === "." || bruto === "./") {
        return { safe: true, relative: "", absolute: mountPath, isRoot: true }
    }

    if (bruto.startsWith("/") || bruto.startsWith("\\")) {
        return { safe: false, reason: "ABSOLUTE_PATH_NOT_ALLOWED" }
    }

    const segmentos = bruto.split(/[\\/]+/).filter((segmento) => segmento.length > 0)

    if (segmentos.some((segmento) => segmento === "..")) {
        return { safe: false, reason: "PATH_TRAVERSAL_NOT_ALLOWED" }
    }
    if (segmentos.some((segmento) => segmento.includes("\0"))) {
        return { safe: false, reason: "INVALID_PATH" }
    }
    // "." no meio é inofensivo, mas remover deixa o caminho canônico — dois
    // caminhos diferentes para o mesmo lugar viram dois nomes na listagem.
    const limpos = segmentos.filter((segmento) => segmento !== ".")
    if (limpos.length === 0) {
        return { safe: true, relative: "", absolute: mountPath, isRoot: true }
    }

    const relative = limpos.join("/")
    return { safe: true, relative, absolute: `${mountPath}/${relative}`, isRoot: false }
}

class VolumePathError extends Error {

    code: string

    constructor(reason: string, message?: string) {
        super(message ?? `Caminho inválido dentro do volume (${reason}).`)
        this.name = "VolumePathError"
        this.code = reason
    }
}

const RequireSafeVolumePath = (relativePath: unknown, options?: { mountPath?: string }) => {
    const resolvido = ResolveVolumeEntryPath(relativePath, options)
    if (!resolvido.safe) throw new VolumePathError(resolvido.reason)
    return resolvido
}

/*
    Nome de arquivo: um único segmento, nunca um caminho. A pasta vem no `path`
    — misturar os dois deixaria "onde" e "o quê" na mesma string, e é assim que
    um nome vindo do cliente vira diretório sem ninguém perceber.
*/
const RequireSafeFileName = (fileName: unknown): string => {
    const resolvido = RequireSafeVolumePath(fileName)
    if (resolvido.isRoot || resolvido.relative.includes("/")) {
        throw new VolumePathError("INVALID_FILE_NAME", "Nome de arquivo inválido — informe só o nome, sem pasta.")
    }
    return resolvido.relative
}

module.exports = ResolveVolumeEntryPath
module.exports.ResolveVolumeEntryPath = ResolveVolumeEntryPath
module.exports.RequireSafeVolumePath = RequireSafeVolumePath
module.exports.RequireSafeFileName = RequireSafeFileName
module.exports.VolumePathError = VolumePathError
module.exports.VOLUME_MOUNT_PATH = VOLUME_MOUNT_PATH
