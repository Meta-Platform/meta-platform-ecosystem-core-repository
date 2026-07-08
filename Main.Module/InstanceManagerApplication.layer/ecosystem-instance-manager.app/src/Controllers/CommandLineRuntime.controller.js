// Controller de execução de pacotes CLI com terminal (PTY) embutido.
//
// Expõe, sobre o daemon, o serviço de terminal:
//  - RunPackage       (POST) inicia um CLI num PTY e devolve o terminalId
//  - List             (GET)  lista as sessões de terminal abertas
//  - Kill             (POST) encerra uma sessão
//  - TerminalStream   (WS)   canal bidirecional do terminal (I/O + resize)
const CommandLineRuntimeController = (params) => {

    const {
        commandLineRuntimeService: {
            RunCommandLinePackage,
            AttachTerminal,
            WriteToTerminal,
            ResizeTerminal,
            KillTerminal,
            ListTerminals
        }
    } = params

    const RunPackage = ({ packagePath, commandLineArgs, cols, rows }) =>
        RunCommandLinePackage({ packagePath, commandLineArgs, cols, rows })

    const List = () => ListTerminals()

    // 1 parâmetro (terminalId) chega como valor direto (contrato do server-manager).
    const Kill = (terminalId) => KillTerminal(terminalId)

    // Canal WebSocket bidirecional de um terminal:
    //  - saída do PTY  -> { type: "data", data }
    //  - saída do fim  -> { type: "exit", exitCode }
    //  - entrada teclas <- { type: "input", data }
    //  - redimensiona  <- { type: "resize", cols, rows }
    const TerminalStream = (ws, terminalId) => {

        const _safeSend = (payload) => { try { ws.send(JSON.stringify(payload)) } catch(e){} }

        let detach
        try {
            detach = AttachTerminal(terminalId, {
                onData: (data)     => _safeSend({ type: "data", data }),
                onExit: (exitCode) => { _safeSend({ type: "exit", exitCode }); try { ws.close() } catch(e){} }
            })
        } catch(error) {
            _safeSend({ type: "error", message: (error && error.message) || String(error) })
            try { ws.close() } catch(e){}
            return
        }

        ws.on && ws.on("message", (raw) => {
            try {
                const message = JSON.parse(raw)
                if(message.type === "input")
                    WriteToTerminal(terminalId, message.data)
                else if(message.type === "resize")
                    ResizeTerminal(terminalId, message.cols, message.rows)
            } catch(e){}
        })

        ws.on && ws.on("close", () => { if(detach) detach() })
    }

    return Object.freeze({
        controllerName: "CommandLineRuntimeController",
        RunPackage,
        List,
        Kill,
        TerminalStream
    })
}

module.exports = CommandLineRuntimeController
