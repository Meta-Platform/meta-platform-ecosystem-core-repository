const assert = require("node:assert/strict") as typeof import("node:assert/strict")
const test = require("node:test") as typeof import("node:test")

const NormalizeContainerEnvironment = require(
    "../src/Helpers/NormalizeContainerEnvironment"
)

test("converte parâmetros efêmeros para o formato Env do Docker", () => {
    assert.deepEqual(
        NormalizeContainerEnvironment({
            META_SERVICE_IDENTITY_SECRET: "one-shot-secret",
            RETRIES: 3,
            OMITTED: undefined
        }),
        [
            "META_SERVICE_IDENTITY_SECRET=one-shot-secret",
            "RETRIES=3"
        ]
    )
})

test("aceita ambiente ausente sem fabricar variáveis", () => {
    assert.deepEqual(
        NormalizeContainerEnvironment(),
        []
    )
})
