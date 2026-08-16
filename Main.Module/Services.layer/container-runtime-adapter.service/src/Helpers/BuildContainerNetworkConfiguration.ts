/*
    Os aliases chegam do formulário em qualquer forma — um texto, uma lista,
    nada, ou algo que não é nem uma coisa nem outra. É por isso que existe o
    filtro por `typeof`, e é por isso que o tipo declarado aqui é `any`:
    prometer `string | string[]` faria esse filtro parecer código morto.
*/
type AliasesDeRede = any

const BUILTIN_NETWORK_MODES = new Set([
    "",
    "bridge",
    "default",
    "host",
    "none"
])

const NormalizeNetworkAliases = (networkAliases: AliasesDeRede = []): string[] =>
    [...new Set(
        (Array.isArray(networkAliases) ? networkAliases : [networkAliases])
            .filter((alias) => typeof alias === "string")
            .map((alias) => alias.trim())
            .filter(Boolean)
    )]

const BuildContainerNetworkConfiguration = ({
    networkmode,
    networkAliases
}: {
    networkmode?: unknown
    networkAliases?: AliasesDeRede
}) => {
    const normalizedNetworkMode =
        typeof networkmode === "string"
            ? networkmode.trim()
            : ""
    const aliases = NormalizeNetworkAliases(networkAliases)

    if (
        BUILTIN_NETWORK_MODES.has(normalizedNetworkMode.toLowerCase())
        || aliases.length === 0
    )
        return {}

    return {
        NetworkingConfig: {
            EndpointsConfig: {
                [normalizedNetworkMode]: {
                    Aliases: aliases
                }
            }
        }
    }
}

module.exports = Object.freeze({
    BuildContainerNetworkConfiguration,
    NormalizeNetworkAliases
})
