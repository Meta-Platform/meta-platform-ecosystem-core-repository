const NormalizeContainerEnvironment = (environment = {}) =>
    Object.entries(environment ?? {})
        .filter(([, value]) =>
            value !== undefined && value !== null
        )
        .map(([name, value]) =>
            `${name}=${String(value)}`
        )

module.exports = NormalizeContainerEnvironment
