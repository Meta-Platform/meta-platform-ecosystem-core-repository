const BUILTIN_NETWORK_MODES = new Set([
    "",
    "bridge",
    "default",
    "host",
    "none"
])

const NormalizeNetworkAliases = (networkAliases = []) =>
    [...new Set(
        (Array.isArray(networkAliases) ? networkAliases : [networkAliases])
            .filter((alias) => typeof alias === "string")
            .map((alias) => alias.trim())
            .filter(Boolean)
    )]

const BuildContainerNetworkConfiguration = ({
    networkmode,
    networkAliases
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
