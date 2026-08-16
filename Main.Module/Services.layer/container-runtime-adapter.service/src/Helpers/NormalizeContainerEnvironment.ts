const NormalizeContainerEnvironment = (environment: Record<string, unknown> | null | undefined = {}) =>
    Object.entries(environment ?? {})
        .filter(([, value]) =>
            value !== undefined && value !== null
        )
        .map(([name, value]) =>
            `${name}=${String(value)}`
        )

module.exports = NormalizeContainerEnvironment
