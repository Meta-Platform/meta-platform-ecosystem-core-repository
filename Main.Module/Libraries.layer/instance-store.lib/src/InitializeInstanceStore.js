const os   = require("os")
const path = require("path")
const { Sequelize, DataTypes, Op } = require("sequelize")

const ConvertPathToAbsolutPath = (_path) =>
    path.join(_path).replace("~", os.homedir())

const RUNNING = "RUNNING"
const STOPPED = "STOPPED"

// Um processo com pid próprio (desktop/cli) sobrevive ao daemon; um app
// in-process morre junto com ele. Ver Reconcile.
const KIND_APP     = "app"
const KIND_DESKTOP = "desktop"
const KIND_CLI     = "cli"

// Checagem padrão de vida do processo: o sinal 0 não envia nada, apenas valida
// que o pid existe e é sinalizável por este usuário.
const DefaultIsProcessAlive = (pid) => {
    if(!pid) return false
    try {
        process.kill(pid, 0)
        return true
    } catch(e) {
        // EPERM = existe, mas é de outro usuário → está vivo.
        return e.code === "EPERM"
    }
}

/**
 * Store das INSTÂNCIAS LANÇADAS PELO DAEMON `executor-manager` (SQLite via
 * Sequelize), no padrão do virtual-desk (~/virtual-desk-state/local-databases/*.sqlite).
 *
 * O daemon centraliza a execução, então é ele quem sabe o que colocou no ar.
 * Esse conhecimento vivia só em memória (um Map de processos desktop), e se
 * perdia a cada restart do daemon — deixando aplicações vivas e invisíveis.
 * Aqui ele é persistido.
 *
 * Uma Instance é `{ packagePath, kind, pid?, taskId?, executionId?, launchedBy?, status }`.
 * `packagePath` é a identidade: um mesmo pacote não roda duas vezes ao mesmo tempo.
 */
const InitializeInstanceStore = (storage) => {

    if(!storage) throw new Error("InitializeInstanceStore: 'storage' (caminho do .sqlite) é obrigatório.")

    const sequelize = new Sequelize({
        dialect: "sqlite",
        storage: ConvertPathToAbsolutPath(storage),
        logging: false
    })

    const InstanceModel = sequelize.define("Instance", {
        id:          { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        packagePath: { type: DataTypes.STRING, allowNull: false, unique: true },
        kind:        { type: DataTypes.STRING, allowNull: false },
        pid:         { type: DataTypes.INTEGER, allowNull: true },
        taskId:      { type: DataTypes.INTEGER, allowNull: true },
        executionId: { type: DataTypes.INTEGER, allowNull: true },
        launchedBy:  { type: DataTypes.STRING, allowNull: true },
        status:      { type: DataTypes.STRING, allowNull: false, defaultValue: RUNNING },
        startedAt:   { type: DataTypes.DATE, allowNull: true },
        stoppedAt:   { type: DataTypes.DATE, allowNull: true }
    })

    const ConnectAndSync = async () => {
        await sequelize.authenticate()
        await sequelize.sync()
    }

    const _serialize = ({ packagePath, kind, pid, taskId, executionId, launchedBy, status, startedAt, stoppedAt }) =>
        ({ packagePath, kind, pid, taskId, executionId, launchedBy, status, startedAt, stoppedAt })

    // Registra (ou re-registra) o lançamento de um pacote. Como `packagePath` é
    // único, relançar o mesmo pacote sobrescreve o registro anterior.
    const RegisterLaunch = async ({ packagePath, kind, pid, taskId, executionId, launchedBy }) => {
        const existing = await InstanceModel.findOne({ where: { packagePath } })
        const values = {
            packagePath,
            kind,
            pid:         pid ?? null,
            taskId:      taskId ?? null,
            executionId: executionId ?? null,
            launchedBy:  launchedBy ?? null,
            status:      RUNNING,
            startedAt:   new Date(),
            stoppedAt:   null
        }
        if(existing) {
            await existing.update(values)
            return _serialize(existing)
        }
        const created = await InstanceModel.create(values)
        return _serialize(created)
    }

    // Completa o registro depois que o runtime resolveu taskId/executionId (o
    // lançamento in-process só conhece esses ids após executar o ambiente).
    const AttachRuntimeIds = async ({ packagePath, taskId, executionId }) => {
        const [count] = await InstanceModel.update(
            {
                ...(taskId      !== undefined ? { taskId }      : {}),
                ...(executionId !== undefined ? { executionId } : {})
            },
            { where: { packagePath } })
        return count > 0
    }

    const MarkStopped = async ({ packagePath }) => {
        const [count] = await InstanceModel.update(
            { status: STOPPED, stoppedAt: new Date() },
            { where: { packagePath, status: RUNNING } })
        return count > 0
    }

    const Remove = async ({ packagePath }) =>
        await InstanceModel.destroy({ where: { packagePath } })

    const List = async () =>
        (await InstanceModel.findAll({ order: [["startedAt", "DESC"]] })).map(_serialize)

    const ListRunning = async () =>
        (await InstanceModel.findAll({ where: { status: RUNNING }, order: [["startedAt", "DESC"]] })).map(_serialize)

    const Get = async ({ packagePath }) => {
        const instance = await InstanceModel.findOne({ where: { packagePath } })
        return instance ? _serialize(instance) : undefined
    }

    /**
     * Reconcilia o registro com a realidade — deve rodar no start do daemon.
     *
     * - `desktop`/`cli` têm processo próprio: sobrevivem ao daemon. Se o pid
     *   ainda vive, o registro continua RUNNING (o daemon "readota" a instância);
     *   se morreu, vira STOPPED.
     * - `app` roda in-process no daemon: se o daemon reiniciou, a instância morreu
     *   junto. Todo `app` RUNNING encontrado no start é, por definição, obsoleto.
     *
     * Devolve o que foi readotado e o que foi limpo, para o chamador logar.
     */
    const Reconcile = async ({ IsProcessAlive = DefaultIsProcessAlive } = {}) => {
        const runningList = await ListRunning()

        const adopted = []
        const cleaned = []

        for (const instance of runningList) {
            const hasOwnProcess = instance.kind === KIND_DESKTOP || instance.kind === KIND_CLI
            const isAlive = hasOwnProcess && IsProcessAlive(instance.pid)

            if(isAlive) adopted.push(instance)
            else        cleaned.push(instance)
        }

        if(cleaned.length > 0)
            await InstanceModel.update(
                { status: STOPPED, stoppedAt: new Date() },
                { where: { packagePath: { [Op.in]: cleaned.map((i) => i.packagePath) } } })

        return { adopted, cleaned }
    }

    return {
        models: { Instance: InstanceModel },
        KIND: { APP: KIND_APP, DESKTOP: KIND_DESKTOP, CLI: KIND_CLI },
        STATUS: { RUNNING, STOPPED },
        IsProcessAlive: DefaultIsProcessAlive,
        ConnectAndSync,
        RegisterLaunch,
        AttachRuntimeIds,
        MarkStopped,
        Remove,
        List,
        ListRunning,
        Get,
        Reconcile
    }
}

module.exports = InitializeInstanceStore
