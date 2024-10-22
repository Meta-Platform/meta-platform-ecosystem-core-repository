const EcosystemManagerController = (params) => {

    const { 
        ecosystemManagerService: {
            RunPackage,
            ListSupervisedPackages,
            GetTaskExecutorEventEmitter
        }
    } = params

    const PackageList = (ws) => {
        GetTaskExecutorEventEmitter()
        .on("TASK_STATUS_CHANGE", async () => {
            try{
                const packages = await ListSupervisedPackages()
                ws.send(JSON.stringify(packages))
            }catch(e){
                console.log(e)
            }
        })
    }

    const controllerServiceObject = {
        controllerName : "EcosystemManagerController",
        RunPackage,
        ListPackages: ListSupervisedPackages,
        PackageList
    }

    return Object.freeze(controllerServiceObject)
}


module.exports = EcosystemManagerController