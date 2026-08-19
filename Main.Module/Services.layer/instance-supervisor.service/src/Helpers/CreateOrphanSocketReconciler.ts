/*
    RECONCILIAÇÃO: quem apaga o arquivo de socket quando o dono morreu sem
    conseguir apagá-lo.

    O package-executor já remove o próprio arquivo ao encerrar (`exit`, SIGINT,
    SIGTERM, SIGHUP, SIGQUIT, exceção não capturada). O que nenhum processo pode
    fazer por si é limpar depois de um SIGKILL, de um OOM killer, de um container
    derrubado ou de uma queda de máquina — e é exatamente esse caso que enchia o
    diretório: arquivos de 9 de junho e de 7 de julho ainda no disco, cada um
    provocando uma tentativa de reconexão a cada 4 s, para sempre.

    APAGAR É DESTRUTIVO, e o critério aqui é deliberadamente conservador. Um
    arquivo só é apagado quando TODAS as condições abaixo valem ao mesmo tempo,
    e valem em duas rodadas consecutivas:

      1. o caminho existe e é um socket;
      2. o supervisor NÃO está com uma conexão viva contra ele — este veto
         sozinho já protege toda instância que o painel enxerga funcionando;
      3. o kernel não tem nenhum listener registrado no caminho
         (`/proc/net/unix`). "Indeterminado" — plataforma sem `/proc` — NÃO
         serve: na dúvida o arquivo fica;
      4. a conexão de teste devolve ECONNREFUSED, ou seja, o kernel afirma que
         não há ninguém do outro lado. Timeout, permissão negada e qualquer
         outro erro NÃO servem: um serviço ocupado ou reiniciando não pode
         perder o próprio socket;
      5. o arquivo tem mais do que o período de graça. Instância subindo cria o
         arquivo antes de qualquer coisa responder por ele, e esse instante não
         pode ser confundido com abandono.

    E a suspeita zera sozinha se o arquivo for RECRIADO no meio do caminho: a
    contagem é indexada pelo inode do arquivo, não pelo nome. Socket novo com
    nome velho começa do zero.
*/

const { unlink } = require("node:fs/promises") as typeof import("node:fs/promises")
const { resolve } = require("node:path") as typeof import("node:path")

/*
    O que a `supervisor.lib` devolve por arquivo de socket. O tipo é redeclarado
    aqui em vez de importado do outro repositório de propósito: em runtime a lib
    chega INJETADA (`supervisorLib.require(...)`), e um `import type` por caminho
    relativo amarraria este pacote à posição do EssentialRepo no disco — verdade
    apenas no workspace de desenvolvimento.

    `listening` tem três estados, e essa é a parte que importa: `undefined`
    significa que a plataforma não soube responder, e "não sei" jamais autoriza
    apagar coisa nenhuma.
*/
type SocketInspection = {
    exists      : boolean
    isSocket    : boolean
    fileInode  ?: number
    ageMs      ?: number
    listening  ?: boolean
    connection  : "ACCEPTED" | "REFUSED" | "MISSING" | "INDETERMINATE"
    evidence    : string
}

/* Uma varredura por minuto: o custo é ler um diretório pequeno e um arquivo do
 * /proc, e o problema que ela resolve leva semanas para incomodar. */
const RECONCILE_INTERVAL_MS = 60000

/* Bem acima de qualquer partida de instância: entre criar o arquivo e ter o
 * listener no ar passam milissegundos, e um minuto de folga custa nada. */
const SOCKET_MINIMUM_AGE_MS = 60000

/* Duas rodadas, porque uma janela de 60 s de "morto" ainda pode ser um engano
 * ambiental; duas seguidas contra o mesmo inode, não. */
const CONFIRMATIONS_REQUIRED = 2

type OrphanSocketReconcilerParams = {
    GetSocketsDirPath      : () => string | undefined
    IsInstanceConnected    : (socketFilePath: string) => boolean
    OnOrphanRemoved        : (report: { socketFileName: string, socketFilePath: string, evidence: string }) => void
    OnOrphanSuspected     ?: (report: { socketFileName: string, socketFilePath: string, evidence: string, confirmations: number }) => void
    OnReconcileFailure    ?: (error: any) => void
    helpers                : {
        ListSocketFilesName : (directoryPath: string) => Promise<string[]>
        InspectSocketFile   : (socketFilePath: string, options?: any) => Promise<SocketInspection>
    }
    intervalMs            ?: number
    minimumAgeMs          ?: number
    confirmationsRequired ?: number
}

const CreateOrphanSocketReconciler = ({
    GetSocketsDirPath,
    IsInstanceConnected,
    OnOrphanRemoved,
    OnOrphanSuspected,
    OnReconcileFailure,
    helpers,
    intervalMs            = RECONCILE_INTERVAL_MS,
    minimumAgeMs          = SOCKET_MINIMUM_AGE_MS,
    confirmationsRequired = CONFIRMATIONS_REQUIRED
}: OrphanSocketReconcilerParams) => {

    const { ListSocketFilesName, InspectSocketFile } = helpers

    /* socketFilePath -> { fileInode, confirmations } */
    const suspeitas: Record<string, { fileInode?: number, confirmations: number }> = {}

    let reconcileTimer: NodeJS.Timeout | undefined = undefined

    const _IsOrphanEvidence = (inspection: SocketInspection): boolean =>
        inspection.exists
        && inspection.isSocket
        && inspection.listening === false
        && inspection.connection === "REFUSED"
        && (inspection.ageMs || 0) >= minimumAgeMs

    const _RegistrarSuspeita = (socketFilePath: string, fileInode?: number): number => {
        const anterior = suspeitas[socketFilePath]
        // Arquivo recriado: outro inode, outra história. A contagem recomeça.
        const confirmations = (anterior && anterior.fileInode === fileInode)
            ? anterior.confirmations + 1
            : 1
        suspeitas[socketFilePath] = { fileInode, confirmations }
        return confirmations
    }

    const _AbsolverSocket = (socketFilePath: string) => {
        delete suspeitas[socketFilePath]
    }

    const _RemoverArquivoOrfao = async (socketFileName: string, socketFilePath: string, evidence: string) => {
        try {
            await unlink(socketFilePath)
            _AbsolverSocket(socketFilePath)
            OnOrphanRemoved({ socketFileName, socketFilePath, evidence })
        } catch(e: any) {
            // Alguém apagou antes (outro supervisor no mesmo host, o próprio
            // dono voltando à vida): não é erro, é o resultado desejado.
            if(e && e.code === "ENOENT"){
                _AbsolverSocket(socketFilePath)
                return
            }
            Log.error("CreateOrphanSocketReconciler", `Não foi possível remover o socket órfão ${socketFilePath}: ${e && e.message ? e.message : e}`, e)
        }
    }

    const _ReconciliarSocket = async (socketsDirPath: string, socketFileName: string) => {

        const socketFilePath = resolve(socketsDirPath, socketFileName)

        // VETO MAIS FORTE, e o mais barato: se o supervisor está falando com
        // esta instância agora, não há o que discutir.
        if(IsInstanceConnected(socketFilePath)){
            _AbsolverSocket(socketFilePath)
            return
        }

        const inspection = await InspectSocketFile(socketFilePath)

        if(!_IsOrphanEvidence(inspection)){
            _AbsolverSocket(socketFilePath)
            return
        }

        const confirmations = _RegistrarSuspeita(socketFilePath, inspection.fileInode)

        if(confirmations < confirmationsRequired){
            if(OnOrphanSuspected) OnOrphanSuspected({ socketFileName, socketFilePath, evidence: inspection.evidence, confirmations })
            return
        }

        await _RemoverArquivoOrfao(socketFileName, socketFilePath, inspection.evidence)
    }

    /*
        Uma rodada completa. Exposta porque é assim que o comportamento se
        testa: a política não pode depender do relógio para ser verificável.
    */
    const RunOnce = async () => {
        const socketsDirPath = GetSocketsDirPath()
        if(!socketsDirPath) return

        try {
            const socketFileNames = await ListSocketFilesName(socketsDirPath)

            // Nome que sumiu do diretório não tem mais suspeita para carregar.
            Object.keys(suspeitas)
            .filter((socketFilePath) => !socketFileNames.some((socketFileName) => resolve(socketsDirPath, socketFileName) === socketFilePath))
            .forEach(_AbsolverSocket)

            for(const socketFileName of socketFileNames){
                await _ReconciliarSocket(socketsDirPath, socketFileName)
            }
        } catch(e) {
            // Uma rodada que falha não pode derrubar o supervisor: a próxima
            // tenta de novo, e o pior caso é o arquivo órfão continuar lá.
            if(OnReconcileFailure) OnReconcileFailure(e)
            else Log.error("CreateOrphanSocketReconciler", `A reconciliação de sockets órfãos falhou: ${e}`, e)
        }
    }

    const Start = () => {
        if(reconcileTimer) return
        reconcileTimer = setInterval(() => { RunOnce() }, intervalMs)
        // O supervisor é um serviço de vida longa dentro de um host que também
        // precisa poder encerrar: este temporizador não pode ser o motivo de o
        // processo não terminar.
        if(typeof reconcileTimer.unref === "function") reconcileTimer.unref()
    }

    const Stop = () => {
        if(!reconcileTimer) return
        clearInterval(reconcileTimer)
        reconcileTimer = undefined
    }

    return {
        Start,
        Stop,
        RunOnce,
        GetSuspicions: () => ({ ...suspeitas })
    }
}

module.exports = CreateOrphanSocketReconciler
