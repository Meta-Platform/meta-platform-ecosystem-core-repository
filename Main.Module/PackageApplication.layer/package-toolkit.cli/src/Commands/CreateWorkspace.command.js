const CreateWorkspaceCommand = async ({ args, startupParams, params }) => {

    const { WORKSPACE_STORAGE_FILE_PATH } = startupParams
    const { workspaceStoreLib } = params

    const { name, path } = args

    if(name === undefined) throw "O nome da workspace é obrigatório"
    if(path === undefined) throw "O caminho da workspace é obrigatório"

    const InitializeWorkspaceStore = workspaceStoreLib.require("InitializeWorkspaceStore")
    const store = InitializeWorkspaceStore(WORKSPACE_STORAGE_FILE_PATH)

    await store.ConnectAndSync()

    const workspace = await store.Create({ name, path })

    console.log(`Workspace "${workspace.name}" salva (${workspace.path}).`)
}

module.exports = CreateWorkspaceCommand
