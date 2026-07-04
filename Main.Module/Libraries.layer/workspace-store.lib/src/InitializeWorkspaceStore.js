const os   = require("os")
const path = require("path")
const { Sequelize, DataTypes } = require("sequelize")

const ConvertPathToAbsolutPath = (_path) =>
    path.join(_path).replace("~", os.homedir())

/**
 * Inicializa o store de Workspaces (SQLite via Sequelize).
 *
 * Uma Workspace é, neste MVP, um ponteiro { name, path } para um diretório do
 * filesystem que será varrido em busca de pacotes. O caminho do arquivo do banco
 * segue o padrão do virtual-desk (~/virtual-desk-state/local-databases/*.sqlite).
 *
 * Retorna um manager com ciclo de conexão + CRUD, reutilizável por qualquer
 * consumidor (webservice do PackageDeveloper e package-toolkit.cli).
 */
const InitializeWorkspaceStore = (storage) => {

    const sequelize = new Sequelize({
        dialect: "sqlite",
        storage: ConvertPathToAbsolutPath(storage),
        logging: false
    })

    const WorkspaceModel = sequelize.define("Workspace", {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        path: {
            type: DataTypes.STRING,
            allowNull: false
        }
    })

    const ConnectAndSync = async () => {
        await sequelize.authenticate()
        await sequelize.sync()
    }

    const List = async () =>
        (await WorkspaceModel.findAll({ order: [["name", "ASC"]] }))
        .map(({ name, path }) => ({ name, path }))

    const Get = async ({ name }) => {
        const workspace = await WorkspaceModel.findOne({ where: { name } })
        return workspace ? { name: workspace.name, path: workspace.path } : undefined
    }

    const Create = async ({ name, path }) => {
        const [workspace] = await WorkspaceModel.upsert({ name, path })
        return { name: workspace.name, path: workspace.path }
    }

    const Remove = async ({ name }) =>
        await WorkspaceModel.destroy({ where: { name } })

    return {
        models: { Workspace: WorkspaceModel },
        ConnectAndSync,
        List,
        Get,
        Create,
        Remove
    }
}

module.exports = InitializeWorkspaceStore
