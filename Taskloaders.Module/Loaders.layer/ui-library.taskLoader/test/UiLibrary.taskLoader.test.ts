const assert = require("node:assert/strict") as typeof import("node:assert/strict")
const { EventEmitter } = require("node:events") as typeof import("node:events")
const { join } = require("node:path") as typeof import("node:path")
const { mkdtempSync, mkdirSync, writeFileSync } = require("node:fs") as typeof import("node:fs")
const { tmpdir } = require("node:os") as typeof import("node:os")
const test = require("node:test") as typeof import("node:test")
const UiLibraryTaskLoader = require("../src/UiLibrary.taskLoader")

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

test("publica e encerra um handle de biblioteca de UI", () => {
    const root = mkdtempSync(join(tmpdir(), "uilib-"))
    mkdirSync(join(root, "metadata"))
    writeFileSync(join(root, "metadata", "uilib.json"), JSON.stringify({
        alias: "@test-components",
        framework: "react",
        source: "src"
    }))

    const channel = new EventEmitter()
    const statuses: any[] = []
    channel.on(Events.CHANGE_TASK_STATUS, (status: any) => statuses.push(status))
    const getHandle = UiLibraryTaskLoader({
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
    assert.equal(getHandle().getRootPath(), root)
    assert.equal(getHandle().getSourcePath(), join(root, "src"))
    assert.equal(getHandle().getEnvironmentPath(), "/tmp/environment")
    assert.equal(
        getHandle().getNodeModulesPath(),
        join("/tmp/environment", "dependencies", "test.uilib", "node_modules")
    )
    assert.deepEqual(statuses, [Statuses.STARTING, Statuses.ACTIVE])

    channel.emit(Events.STOP_TASK)
    assert.equal(getHandle(), undefined)
    assert.equal(statuses.at(-1), Statuses.TERMINATED)
})

// A janela de compatibilidade fechou: `metadata/webgui-library.json` é apenas um
// arquivo qualquer, e um pacote que só tenha ele não é mais uma biblioteca de UI.
test("não aceita mais o manifesto antigo, webgui-library.json", () => {
    const root = mkdtempSync(join(tmpdir(), "uilib-legacy-"))
    mkdirSync(join(root, "metadata"))
    writeFileSync(join(root, "metadata", "webgui-library.json"), JSON.stringify({
        alias: "@antigo",
        source: "src"
    }))

    const channel = new EventEmitter()
    const statuses: any[] = []
    channel.on(Events.CHANGE_TASK_STATUS, (...args: any[]) => statuses.push(args))

    UiLibraryTaskLoader({
        TaskStatusTypes: Statuses,
        CommandChannelEventTypes: Events
    })({
        path: root,
        environmentPath: "/tmp/environment",
        tag: "@/legacy.uilib",
        EXECUTIONDATA_CONF_DIRNAME_DEPENDENCIES: "dependencies"
    }, channel)

    channel.emit(Events.START_TASK)
    assert.equal(statuses.at(-1)[0], Statuses.FAILURE)
    assert.match(statuses.at(-1)[1], /metadata[\\/]uilib\.json/)
})

test("falha sem manifesto nenhum", () => {
    const root = mkdtempSync(join(tmpdir(), "uilib-missing-"))
    mkdirSync(join(root, "metadata"))
    const channel = new EventEmitter()
    const statuses: any[] = []
    channel.on(Events.CHANGE_TASK_STATUS, (...args: any[]) => statuses.push(args))

    UiLibraryTaskLoader({
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
    assert.match(statuses.at(-1)[1], /metadata[\\/]uilib\.json/)
})

test("falha com manifesto incompleto", () => {
    const root = mkdtempSync(join(tmpdir(), "uilib-invalid-"))
    mkdirSync(join(root, "metadata"))
    writeFileSync(join(root, "metadata", "uilib.json"), "{}")
    const channel = new EventEmitter()
    const statuses: any[] = []
    channel.on(Events.CHANGE_TASK_STATUS, (...args: any[]) => statuses.push(args))

    UiLibraryTaskLoader({
        TaskStatusTypes: Statuses,
        CommandChannelEventTypes: Events
    })({
        path: root,
        environmentPath: "/tmp/environment",
        tag: "@/invalid.uilib",
        EXECUTIONDATA_CONF_DIRNAME_DEPENDENCIES: "dependencies"
    }, channel)

    channel.emit(Events.START_TASK)
    assert.equal(statuses.at(-1)[0], Statuses.FAILURE)
    assert.match(statuses.at(-1)[1], /alias e source/)
})
