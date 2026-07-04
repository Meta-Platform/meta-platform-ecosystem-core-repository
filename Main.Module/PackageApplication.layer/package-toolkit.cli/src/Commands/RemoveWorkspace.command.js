const RemoveWorkspaceCommand = async ({ args, startupParams, params }) => {

    const { WORKSPACE_STORAGE_FILE_PATH } = startupParams
    const { workspaceStoreLib } = params

    const { name } = args

    if(name === undefined) throw "O nome da workspace é obrigatório"

    const InitializeWorkspaceStore = workspaceStoreLib.require("InitializeWorkspaceStore")
    const store = InitializeWorkspaceStore(WORKSPACE_STORAGE_FILE_PATH)

    await store.ConnectAndSync()

    const removed = await store.Remove({ name })

    console.log(removed > 0
        ? `Workspace "${name}" removida.`
        : `Workspace "${name}" não encontrada.`)
}

module.exports = RemoveWorkspaceCommand
