const { rmSync } = require("fs") as typeof import("fs")

/** Quem escuta uma sessão — na prática, um WebSocket do painel. */
type SessionListener = {
    onData?: (data: string) => void
    onExit?: (exitCode: number | null) => void
}

type TerminalSession = {
    terminalId: string
    ptyProcess: any
    executableName: string
    packagePath: string
    supervisorDir?: string
    listeners: Set<SessionListener>
    outputChunks: string[]
    exited: boolean
    exitCode: number | null
}

// Máximo de chunks de saída retidos por sessão para "replay" ao conectar.
// Cobre a janela entre iniciar o CLI e o painel abrir o stream (os logs
// iniciais do CLI saem imediatamente e seriam perdidos sem buffer).
const MAX_BUFFER_CHUNKS = 2000

// Estado em memória das sessões de terminal (PTY) abertas pelo daemon.
// Cada sessão embrulha um processo node-pty e distribui os dados do PTY para
// os "attachers" (tipicamente um WebSocket do painel).
const CreateTerminalSessionState = () => {

    const sessions = new Map<string, TerminalSession>()
    let counter = 0

    const _GetOrThrow = (terminalId: string): TerminalSession => {
        const session = sessions.get(terminalId)
        if(!session)
            throw new Error(`Sessão de terminal '${terminalId}' não encontrada`)
        return session
    }

    // Registra um novo processo PTY e passa a distribuir seus eventos.
    // supervisorDir (opcional): subdiretório do socket de supervisão desta
    // instância, removido quando o processo termina.
    const Register = ({ ptyProcess, executableName, packagePath, supervisorDir }: {
        ptyProcess: any
        executableName: string
        packagePath: string
        supervisorDir?: string
    }): string => {
        counter += 1
        const terminalId = `terminal-${counter}`

        const session: TerminalSession = {
            terminalId,
            ptyProcess,
            executableName,
            packagePath,
            supervisorDir,
            listeners: new Set(),
            outputChunks: [],
            exited: false,
            exitCode: null
        }

        ptyProcess.onData((data: string) => {
            session.outputChunks.push(data)
            if(session.outputChunks.length > MAX_BUFFER_CHUNKS)
                session.outputChunks.shift()
            session.listeners.forEach((listener) =>
                listener.onData && listener.onData(data))
        })

        ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
            session.exited = true
            session.exitCode = exitCode
            // remove o subdiretório do socket de supervisão desta instância
            if(session.supervisorDir){
                try { rmSync(session.supervisorDir, { recursive: true, force: true }) } catch(e){}
            }
            session.listeners.forEach((listener) =>
                listener.onExit && listener.onExit(exitCode))
        })

        sessions.set(terminalId, session)
        return terminalId
    }

    // Assina os eventos de uma sessão. Se o processo já terminou, notifica o
    // encerramento imediatamente. Retorna uma função para cancelar a assinatura.
    const Attach = (terminalId: string, listener: SessionListener) => {
        const session = _GetOrThrow(terminalId)

        // Replay do que já saiu, para o cliente que conecta após o início do CLI.
        // (síncrono — nenhum evento ao vivo se intercala antes do add abaixo)
        if(listener.onData)
            session.outputChunks.forEach((chunk) => listener.onData!(chunk))

        session.listeners.add(listener)

        if(session.exited && listener.onExit)
            listener.onExit(session.exitCode)

        return () => session.listeners.delete(listener)
    }

    // Envia dados (teclas) do painel para o processo do CLI.
    const Write = (terminalId: string, data: string) => {
        const session = _GetOrThrow(terminalId)
        if(!session.exited)
            session.ptyProcess.write(data)
    }

    // Redimensiona o terminal (mantém o layout do CLI correto).
    const Resize = (terminalId: string, cols: number, rows: number) => {
        const session = _GetOrThrow(terminalId)
        if(!session.exited)
            session.ptyProcess.resize(cols, rows)
    }

    // Encerra o processo do CLI.
    const Kill = (terminalId: string) => {
        const session = _GetOrThrow(terminalId)
        if(!session.exited)
            session.ptyProcess.kill()
        return {}
    }

    // Lista as sessões abertas (metadados, sem o processo).
    const List = () =>
        Array.from(sessions.values()).map(({ terminalId, executableName, packagePath, exited, exitCode }) =>
            ({ terminalId, executableName, packagePath, exited, exitCode }))

    return {
        Register,
        Attach,
        Write,
        Resize,
        Kill,
        List
    }
}

module.exports = CreateTerminalSessionState
