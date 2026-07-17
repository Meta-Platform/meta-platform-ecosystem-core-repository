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

// Tabela renomeada durante a migração do schema antigo (ver _MigrateLegacySchema).
const LEGACY_TABLE = "Instances_legacy"

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
 * Uma Instance é `{ instanceId, packagePath, kind, pid?, taskId?, executionId?, launchedBy?, status }`.
 *
 * `instanceId` — e não `packagePath` — é a identidade. Um pacote DESKTOP roda em
 * várias instâncias simultâneas (o usuário abre a mesma aplicação duas vezes), e
 * cada uma precisa ser distinguível para ser encerrada e contada individualmente.
 * `app` e `cli` continuam sendo um-por-packagePath: relançá-los sobrescreve o
 * registro anterior.
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
        instanceId:  { type: DataTypes.STRING, allowNull: false, unique: true },
        packagePath: { type: DataTypes.STRING, allowNull: false },
        kind:        { type: DataTypes.STRING, allowNull: false },
        pid:         { type: DataTypes.INTEGER, allowNull: true },
        taskId:      { type: DataTypes.INTEGER, allowNull: true },
        executionId: { type: DataTypes.INTEGER, allowNull: true },
        // Caminho do Unix socket que o processo separado (desktop) abre para expor
        // seu próprio task-executor — é por ele que o daemon consulta as tarefas
        // internas da instância. Nulo para `app` (roda in-process no daemon).
        taskSocketPath: { type: DataTypes.STRING, allowNull: true },
        launchedBy:  { type: DataTypes.STRING, allowNull: true },
        status:      { type: DataTypes.STRING, allowNull: false, defaultValue: RUNNING },
        startedAt:   { type: DataTypes.DATE, allowNull: true },
        stoppedAt:   { type: DataTypes.DATE, allowNull: true }
    })

    // Colunas adicionadas depois do schema base. `sync()` NÃO altera tabela
    // existente, e o SQLite não tem "ADD COLUMN IF NOT EXISTS", então cada ALTER
    // roda em try/catch idempotente (ignora "duplicate column" / tabela nova).
    // Mesmo padrão do project-store.lib.
    const ADDED_COLUMNS = [
        ["Instances", "taskSocketPath", "VARCHAR(255)"]
    ]

    const _MigrateAddedColumns = async () => {
        for (const [table, column, type] of ADDED_COLUMNS) {
            try {
                await sequelize.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${type}`)
            } catch(e) { /* coluna já existe ou tabela ainda não criada: ok */ }
        }
    }

    /**
     * O schema anterior tinha `packagePath NOT NULL UNIQUE` e não tinha
     * `instanceId`. `sync()` não altera tabela existente, e o SQLite não remove
     * uma constraint UNIQUE por ALTER TABLE — a tabela precisa ser recriada.
     *
     * Renomeamos a antiga aqui; o `sync()` seguinte cria a nova no formato certo
     * e `_CopyLegacyRows` traz as linhas de volta. O `launchId` legado ERA o
     * `packagePath`, então ele vira o `instanceId` das linhas migradas — o que
     * mantém coerente qualquer instância desktop viva sendo readotada pelo
     * Reconcile.
     *
     * Devolve `true` se houve renomeação (ou seja: há linhas a copiar).
     */
    const _MigrateLegacySchema = async () => {
        const queryInterface = sequelize.getQueryInterface()
        const tableName = InstanceModel.getTableName()

        let description
        try {
            description = await queryInterface.describeTable(tableName)
        } catch(e) {
            return false // tabela ainda não existe: o sync() já a cria no formato novo
        }

        if(description.instanceId) return false // já migrada

        await sequelize.query(`DROP TABLE IF EXISTS \`${LEGACY_TABLE}\``)
        await queryInterface.renameTable(tableName, LEGACY_TABLE)
        return true
    }

    const _CopyLegacyRows = async () => {
        const tableName = InstanceModel.getTableName()
        await sequelize.query(
            `INSERT INTO \`${tableName}\`
                (instanceId, packagePath, kind, pid, taskId, executionId, launchedBy, status, startedAt, stoppedAt, createdAt, updatedAt)
             SELECT packagePath, packagePath, kind, pid, taskId, executionId, launchedBy, status, startedAt, stoppedAt, createdAt, updatedAt
               FROM \`${LEGACY_TABLE}\``)
        await sequelize.query(`DROP TABLE \`${LEGACY_TABLE}\``)
    }

    const ConnectAndSync = async () => {
        await sequelize.authenticate()
        const hasLegacyRows = await _MigrateLegacySchema()
        await sequelize.sync()
        await _MigrateAddedColumns()
        if(hasLegacyRows) await _CopyLegacyRows()
    }

    const _serialize = ({ instanceId, packagePath, kind, pid, taskId, executionId, taskSocketPath, launchedBy, status, startedAt, stoppedAt }) =>
        ({ instanceId, packagePath, kind, pid, taskId, executionId, taskSocketPath, launchedBy, status, startedAt, stoppedAt })

    /**
     * Registra o lançamento de uma instância. `instanceId` é gerado por quem
     * lança (o daemon) e identifica esta execução específica.
     *
     * DESKTOP cria sempre uma linha nova — é o kind que admite várias instâncias
     * do mesmo pacote. Os demais são um-por-pacote: se já houver uma instância
     * RUNNING daquele packagePath, ela é sobrescrita.
     */
    const RegisterLaunch = async ({ instanceId, packagePath, kind, pid, taskId, executionId, taskSocketPath, launchedBy }) => {
        if(!instanceId) throw new Error("RegisterLaunch: 'instanceId' é obrigatório.")

        const values = {
            instanceId,
            packagePath,
            kind,
            pid:            pid ?? null,
            taskId:         taskId ?? null,
            executionId:    executionId ?? null,
            taskSocketPath: taskSocketPath ?? null,
            launchedBy:     launchedBy ?? null,
            status:         RUNNING,
            startedAt:      new Date(),
            stoppedAt:      null
        }

        if(kind !== KIND_DESKTOP) {
            const existing = await InstanceModel.findOne({ where: { packagePath, status: RUNNING } })
            if(existing) {
                await existing.update(values)
                return _serialize(existing)
            }
        }

        const created = await InstanceModel.create(values)
        return _serialize(created)
    }

    // Completa o registro depois que o runtime resolveu taskId/executionId (o
    // lançamento in-process só conhece esses ids após executar o ambiente).
    const AttachRuntimeIds = async ({ instanceId, taskId, executionId }) => {
        const [count] = await InstanceModel.update(
            {
                ...(taskId      !== undefined ? { taskId }      : {}),
                ...(executionId !== undefined ? { executionId } : {})
            },
            { where: { instanceId } })
        return count > 0
    }

    const MarkStopped = async ({ instanceId }) => {
        const [count] = await InstanceModel.update(
            { status: STOPPED, stoppedAt: new Date() },
            { where: { instanceId, status: RUNNING } })
        return count > 0
    }

    // Encerra o registro de TODAS as instâncias RUNNING de um pacote. Usado no
    // encerramento por packagePath (que não distingue instâncias).
    const MarkStoppedByPackage = async ({ packagePath }) => {
        const [count] = await InstanceModel.update(
            { status: STOPPED, stoppedAt: new Date() },
            { where: { packagePath, status: RUNNING } })
        return count > 0
    }

    const Remove = async ({ instanceId }) =>
        await InstanceModel.destroy({ where: { instanceId } })

    const List = async () =>
        (await InstanceModel.findAll({ order: [["startedAt", "DESC"]] })).map(_serialize)

    const ListRunning = async () =>
        (await InstanceModel.findAll({ where: { status: RUNNING }, order: [["startedAt", "DESC"]] })).map(_serialize)

    const ListRunningByPackage = async ({ packagePath }) =>
        (await InstanceModel.findAll({ where: { packagePath, status: RUNNING }, order: [["startedAt", "ASC"]] })).map(_serialize)

    const Get = async ({ instanceId }) => {
        const instance = await InstanceModel.findOne({ where: { instanceId } })
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
                { where: { instanceId: { [Op.in]: cleaned.map((i) => i.instanceId) } } })

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
        MarkStoppedByPackage,
        Remove,
        List,
        ListRunning,
        ListRunningByPackage,
        Get,
        Reconcile
    }
}

module.exports = InitializeInstanceStore
