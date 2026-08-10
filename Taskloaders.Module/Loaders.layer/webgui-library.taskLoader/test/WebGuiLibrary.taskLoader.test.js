const assert = require("node:assert/strict")
const { EventEmitter } = require("node:events")
const { join } = require("node:path")
const { mkdtempSync, mkdirSync, writeFileSync } = require("node:fs")
const { tmpdir } = require("node:os")
const test = require("node:test")
const WebGuiLibraryTaskLoader = require("../src/WebGuiLibrary.taskLoader")

const Events = {
    START_TASK: "start",
    STOP_TASK: "stop",
    CHANGE_TASK_STATUS: "status"
}
const Statuses = {
    STARTING: "STARTING",
    ACTIVE: "ACTIVE",
    FAILURE: "FAILURE",
    TERMINATED: "TERMINATED"
}

test("publica e encerra um handle de biblioteca WebGui", () => {
    const root = mkdtempSync(join(tmpdir(), "icomponents-"))
    mkdirSync(join(root, "metadata"))
    writeFileSync(join(root, "metadata", "webgui-library.json"), JSON.stringify({
        alias: "@test-components",
        framework: "react",
        source: "src"
    }))

    const channel = new EventEmitter()
    const statuses = []
    channel.on(Events.CHANGE_TASK_STATUS, (status) => statuses.push(status))
    const getHandle = WebGuiLibraryTaskLoader({
        TaskStatusTypes: Statuses,
        CommandChannelEventTypes: Events
    })({
        path: root,
        environmentPath: "/tmp/environment",
        tag: "@/test.icomponents",
        EXECUTIONDATA_CONF_DIRNAME_DEPENDENCIES: "dependencies"
    }, channel)

    channel.emit(Events.START_TASK)
    assert.equal(getHandle().getManifest().alias, "@test-components")
    assert.equal(getHandle().getSourcePath(), join(root, "src"))
    assert.deepEqual(statuses, [Statuses.STARTING, Statuses.ACTIVE])

    channel.emit(Events.STOP_TASK)
    assert.equal(getHandle(), undefined)
    assert.equal(statuses.at(-1), Statuses.TERMINATED)
})

test("lê o manifesto novo, metadata/uilib.json", () => {
    const root = mkdtempSync(join(tmpdir(), "uilib-"))
    mkdirSync(join(root, "metadata"))
    writeFileSync(join(root, "metadata", "uilib.json"), JSON.stringify({
        alias: "@test-components",
        framework: "react",
        source: "src"
    }))

    const channel = new EventEmitter()
    const getHandle = WebGuiLibraryTaskLoader({
        TaskStatusTypes: Statuses,
        CommandChannelEventTypes: Events
    })({
        path: root,
        environmentPath: "/tmp/environment",
        tag: "@/test.uilib",
        EXECUTIONDATA_CONF_DIRNAME_DEPENDENCIES: "dependencies"
    }, channel)

    channel.emit(Events.START_TASK)
    assert.equal(getHandle().getManifest().alias, "@test-components")
    assert.equal(getHandle().getSourcePath(), join(root, "src"))
})

// Um pacote em transição pode ter os dois arquivos. O novo tem de vencer, senão
// renomear o manifesto não teria efeito enquanto o antigo não fosse apagado.
test("o manifesto novo tem precedência sobre o antigo", () => {
    const root = mkdtempSync(join(tmpdir(), "uilib-both-"))
    mkdirSync(join(root, "metadata"))
    writeFileSync(join(root, "metadata", "uilib.json"), JSON.stringify({ alias: "@novo", source: "src" }))
    writeFileSync(join(root, "metadata", "webgui-library.json"), JSON.stringify({ alias: "@antigo", source: "src" }))

    const channel = new EventEmitter()
    const getHandle = WebGuiLibraryTaskLoader({
        TaskStatusTypes: Statuses,
        CommandChannelEventTypes: Events
    })({
        path: root,
        environmentPath: "/tmp/environment",
        tag: "@/both.uilib",
        EXECUTIONDATA_CONF_DIRNAME_DEPENDENCIES: "dependencies"
    }, channel)

    channel.emit(Events.START_TASK)
    assert.equal(getHandle().getManifest().alias, "@novo")
})

test("falha sem manifesto nenhum", () => {
    const root = mkdtempSync(join(tmpdir(), "uilib-missing-"))
    mkdirSync(join(root, "metadata"))
    const channel = new EventEmitter()
    const statuses = []
    channel.on(Events.CHANGE_TASK_STATUS, (...args) => statuses.push(args))

    WebGuiLibraryTaskLoader({
        TaskStatusTypes: Statuses,
        CommandChannelEventTypes: Events
    })({
        path: root,
        environmentPath: "/tmp/environment",
        tag: "@/missing.uilib",
        EXECUTIONDATA_CONF_DIRNAME_DEPENDENCIES: "dependencies"
    }, channel)

    channel.emit(Events.START_TASK)
    assert.equal(statuses.at(-1)[0], Statuses.FAILURE)
    assert.match(statuses.at(-1)[1], /metadata\/uilib\.json/)
})

test("falha com manifesto incompleto", () => {
    const root = mkdtempSync(join(tmpdir(), "icomponents-invalid-"))
    mkdirSync(join(root, "metadata"))
    writeFileSync(join(root, "metadata", "webgui-library.json"), "{}")
    const channel = new EventEmitter()
    const statuses = []
    channel.on(Events.CHANGE_TASK_STATUS, (...args) => statuses.push(args))

    WebGuiLibraryTaskLoader({
        TaskStatusTypes: Statuses,
        CommandChannelEventTypes: Events
    })({
        path: root,
        environmentPath: "/tmp/environment",
        tag: "@/invalid.icomponents",
        EXECUTIONDATA_CONF_DIRNAME_DEPENDENCIES: "dependencies"
    }, channel)

    channel.emit(Events.START_TASK)
    assert.equal(statuses.at(-1)[0], Statuses.FAILURE)
    assert.match(statuses.at(-1)[1], /alias e source/)
})
