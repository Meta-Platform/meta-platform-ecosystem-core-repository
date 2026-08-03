const assert = require("node:assert/strict")
const test = require("node:test")

const {
    BuildContainerNetworkConfiguration,
    NormalizeNetworkAliases
} = require("../src/Helpers/BuildContainerNetworkConfiguration")

test("preserva aliases únicos e ignora valores inválidos", () => {
    assert.deepEqual(
        NormalizeNetworkAliases([
            "service-panel",
            " service-panel ",
            "",
            null,
            "service-orchestrator-panel"
        ]),
        [
            "service-panel",
            "service-orchestrator-panel"
        ]
    )
})

test("declara aliases DNS na rede primária nomeada", () => {
    assert.deepEqual(
        BuildContainerNetworkConfiguration({
            networkmode: "ring1-platform",
            networkAliases: ["service-panel"]
        }),
        {
            NetworkingConfig: {
                EndpointsConfig: {
                    "ring1-platform": {
                        Aliases: ["service-panel"]
                    }
                }
            }
        }
    )
})

test("não tenta configurar endpoint para modos internos do Docker", () => {
    for (const networkmode of ["bridge", "default", "host", "none"]) {
        assert.deepEqual(
            BuildContainerNetworkConfiguration({
                networkmode,
                networkAliases: ["service-panel"]
            }),
            {}
        )
    }
})
