const ListWorkspacesCommand = async ({ startupParams, params }) => {

    const { WORKSPACE_STORAGE_FILE_PATH } = startupParams
    const { workspaceStoreLib } = params

    const InitializeWorkspaceStore = workspaceStoreLib.require("InitializeWorkspaceStore")
    const store = InitializeWorkspaceStore(WORKSPACE_STORAGE_FILE_PATH)

    await store.ConnectAndSync()

    const workspaces = await store.List()

    if(workspaces.length === 0){
        Log.message("ListWorkspaces", "Nenhuma workspace cadastrada.")
        return
    }

    workspaces.forEach(({ name, path }) => Log.message("ListWorkspaces", `- ${name}\n    ${path}`))
}

module.exports = ListWorkspacesCommand
