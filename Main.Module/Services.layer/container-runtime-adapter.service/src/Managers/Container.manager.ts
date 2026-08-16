/*
    O ContainerRuntimeAdapter.

    Este arquivo era 1354 linhas com tudo dentro, e o épico CTMG-35 leva a
    superfície de 35 para cerca de 70 operações. Fatiar ANTES (CTMG-36) tem duas
    razões: nenhum arquivo passa de umas poucas centenas de linhas, e vários
    agentes trabalhando em paralelo tocam arquivos diferentes em vez de
    disputarem o mesmo.

    A superfície PÚBLICA não mudou nesta refatoração: mesmo objeto plano, mesmos
    nomes, mesmas assinaturas. `test/RuntimeSurfaceParity.test.js` e
    `test/ContainerManagerSurface.test.js` guardam isso.

    Cada módulo de `src/Operations/` é uma fábrica `(ctx) => ({ ...ops })`. O
    contexto carrega o cliente do runtime e o que é compartilhado entre domínios;
    o que é de um domínio só mora no módulo dele.

    ---

    `require` de dependência npm no TOPO do módulo, sempre. O executor da
    plataforma aponta o NODE_PATH para as dependências do pacote apenas enquanto
    o módulo é carregado, e o restaura logo depois: um require adiado procura num
    caminho que já não existe e falha com MODULE_NOT_FOUND mesmo com a
    dependência instalada (CTMG-13).
*/

import type { RuntimeClientOptions } from "./Types"

const Docker = require('dockerode') as new (options?: RuntimeClientOptions) => any

const StreamToBuffer = require("../Helpers/StreamToBuffer") as (stream: any, options?: { limiteEmBytes?: number | null, descricao?: string }) => Promise<Buffer>
const SafeFileName = require("../Helpers/SafeFileName") as (value: unknown, fallback?: string) => string
const CreateEphemeralVolumeContainerFactory = require("../Helpers/EphemeralVolumeContainer") as (options: { docker: any }) => any

const CreateContainerOperations = require("../Operations/Containers.ops") as (contexto: any) => any
const CreateImageOperations = require("../Operations/Images.ops") as (contexto: any) => any
const CreateNetworkOperations = require("../Operations/Networks.ops") as (contexto: any) => any
const CreateVolumeOperations = require("../Operations/Volumes.ops") as (contexto: any) => any
const CreateFileOperations = require("../Operations/Files.ops") as (contexto: any) => any
const CreateSystemOperations = require("../Operations/System.ops") as (contexto: any) => any

type ContainerManagerParams = {
    onReady?: () => void
    socketPath?: string
    connectionOptions?: RuntimeClientOptions
    CreateClient?: (options: RuntimeClientOptions) => any
}

const ContainerManager = (params: ContainerManagerParams) => {

    const {
        onReady,
        socketPath,
        // Conexão já resolvida (socket unix OU host TCP), usada quando o
        // adaptador é instanciado por conexão em vez de fixado no boot
        // (ContainerRuntimeConnection.manager, CTMG-8). `socketPath` continua
        // sendo o caminho de quem monta este serviço pelo boot.json.
        connectionOptions,
        /*
            O cliente do runtime entra por parâmetro (CTMG-30) para que o
            MAPEAMENTO de campos possa ser verificado sem daemon nenhum.

            Este manager traduz um punhado de campos hoje e vai traduzir umas
            seis dezenas: é justamente essa tradução que precisa de teste, e
            ela não deveria exigir Docker instalado para ser exercitada. O
            padrão é o cliente de verdade, então nada muda para quem já usa.
        */
        CreateClient = (options) => new Docker(options)
    } = params

    const docker = CreateClient(connectionOptions || { socketPath })

    // Montar volume em container efêmero é a única forma de tocar no conteúdo
    // de um volume. Duas famílias de operação precisam disso — exportar o
    // volume e mexer nos arquivos dele —, então nasce uma vez e é partilhado.
    const ephemeral = CreateEphemeralVolumeContainerFactory({ docker })

    const contexto = { docker, StreamToBuffer, SafeFileName, ephemeral }

    const _Start = async () => {
        // Montado pelo boot.json, `onReady` sinaliza o supervisor. Instanciado
        // por conexão, não há supervisor para avisar — e a ausência do sinal
        // não pode derrubar o adaptador.
        if (typeof onReady === "function") onReady()
    }

    _Start()

    /*
        Containers vem primeiro porque Files depende do `RunExec` dele:
        listar arquivo de container em execução É um exec, e reimplementá-lo
        no outro módulo significaria manter duas decodificações do fluxo
        binário do runtime — que foi exatamente o defeito do terminal.
    */
    const operacoesDeContainer = CreateContainerOperations(contexto)

    return {
        ...operacoesDeContainer,
        ...CreateImageOperations(contexto),
        ...CreateNetworkOperations(contexto),
        ...CreateVolumeOperations(contexto),
        ...CreateFileOperations({ ...contexto, RunExec: operacoesDeContainer.RunExec }),
        ...CreateSystemOperations(contexto)
    }

}

module.exports = ContainerManager
