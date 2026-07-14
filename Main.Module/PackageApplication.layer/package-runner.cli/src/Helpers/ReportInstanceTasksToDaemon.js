const http = require("http")

// POST best-effort da lista de tarefas deste processo ao daemon, no mesmo canal
// (socket do daemon) que o report-launch-progress usa. É o lado de PUSH do
// monitoramento de tarefas por instância: o daemon cacheia e faz stream ao painel
// por WebSocket, sem polling. Falha em silêncio — é só observabilidade.
const ReportInstanceTasksToDaemon = ({ daemonSocketPath, instanceId, tasks }) => new Promise((resolve) => {
    if(!daemonSocketPath || !instanceId){ resolve(); return }
    const payload = JSON.stringify({ instanceId, tasks: tasks || [] })
    const req = http.request({
        socketPath: daemonSocketPath,
        path: "/ecosystem-manager/report-instance-tasks",
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }
    }, (res) => { res.on("data", () => {}); res.on("end", resolve) })
    req.on("error", () => resolve())
    req.write(payload)
    req.end()
})

module.exports = ReportInstanceTasksToDaemon
