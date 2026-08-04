/*
    Gera um nome de arquivo seguro a partir de um identificador qualquer —
    nome de imagem, de container ou de volume — para o download que o navegador
    vai salvar.

    NÃO CONFUNDIR com `RequireSafeFileName`, de ResolveVolumeEntryPath.js: aquele
    é uma GUARDA (recusa o que é perigoso, lançando), este é uma SANITIZAÇÃO
    (aceita qualquer coisa e devolve algo utilizável). Um protege o sistema de
    arquivos; o outro só evita um nome de download esquisito.
*/
const SafeFileName = (value, fallback) => {
    const base = (value || fallback || "export")
        .toString()
        .replace(/^\//, "")
        .replace(/[^a-zA-Z0-9._-]/g, "_")
    return base || fallback || "export"
}

module.exports = SafeFileName
