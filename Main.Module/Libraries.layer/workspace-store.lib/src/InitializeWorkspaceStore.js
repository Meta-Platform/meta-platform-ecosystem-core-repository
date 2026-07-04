const os   = require("os")
const path = require("path")
const { Sequelize, DataTypes } = require("sequelize")

const ConvertPathToAbsolutPath = (_path) =>
    path.join(_path).replace("~", os.homedir())

/**
 * Store de Repositories + memória da IDE (SQLite via Sequelize).
 *
 * - Repository (tabela Workspace): { name, path, lastAccessedAt } — cada um é a
 *   raiz de um repositório (dir com metadata/applications.json). `lastAccessedAt`
 *   dá a ordenação de "recentes".
 * - AppState (key/value JSON): memória da IDE (última pasta do picker, posições
 *   de abas, etc.).
 *
 * Caminho do arquivo segue o padrão do virtual-desk
 * (~/virtual-desk-state/local-databases/*.sqlite).
 */
const InitializeWorkspaceStore = (storage) => {

    const sequelize = new Sequelize({
        dialect: "sqlite",
        storage: ConvertPathToAbsolutPath(storage),
        logging: false
    })

    const WorkspaceModel = sequelize.define("Workspace", {
        id:   { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        name: { type: DataTypes.STRING, allowNull: false, unique: true },
        path: { type: DataTypes.STRING, allowNull: false },
        lastAccessedAt: { type: DataTypes.DATE, allowNull: true }
    })

    const AppStateModel = sequelize.define("AppState", {
        key:   { type: DataTypes.STRING, allowNull: false, unique: true, primaryKey: true },
        value: { type: DataTypes.JSON, allowNull: true }
    })

    const ConnectAndSync = async () => {
        await sequelize.authenticate()
        await sequelize.sync()
    }

    const _serialize = ({ name, path, lastAccessedAt }) => ({ name, path, lastAccessedAt })

    const List = async () =>
        (await WorkspaceModel.findAll({ order: [["name", "ASC"]] })).map(_serialize)

    // Recentes: ordenados por último acesso (desc), depois nome.
    const ListRecent = async (limit = 10) =>
        (await WorkspaceModel.findAll({
            order: [["lastAccessedAt", "DESC"], ["name", "ASC"]],
            limit
        })).map(_serialize)

    const Get = async ({ name }) => {
        const workspace = await WorkspaceModel.findOne({ where: { name } })
        return workspace ? _serialize(workspace) : undefined
    }

    const Create = async ({ name, path }) => {
        const [workspace] = await WorkspaceModel.upsert({ name, path, lastAccessedAt: new Date() })
        return _serialize(workspace)
    }

    // Marca o repositório como acessado agora (para os recentes).
    const Touch = async ({ name }) => {
        const [count] = await WorkspaceModel.update({ lastAccessedAt: new Date() }, { where: { name } })
        return count > 0
    }

    const Remove = async ({ name }) =>
        await WorkspaceModel.destroy({ where: { name } })

    // -------- AppState (memória da IDE) --------
    const GetState = async (key) => {
        const state = await AppStateModel.findOne({ where: { key } })
        return state ? state.value : undefined
    }

    const SetState = async (key, value) => {
        await AppStateModel.upsert({ key, value })
        return value
    }

    return {
        models: { Workspace: WorkspaceModel, AppState: AppStateModel },
        ConnectAndSync,
        List,
        ListRecent,
        Get,
        Create,
        Touch,
        Remove,
        GetState,
        SetState
    }
}

module.exports = InitializeWorkspaceStore
