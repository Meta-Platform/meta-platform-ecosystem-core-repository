const EcosystemManagerController = (params) => {

    const {
        ecosystemManagerService: {
            RunPackage,
            StopPackage,
            ListSupervisedPackages,
            ReportLaunchProgress,
            GetLaunchProgressSnapshot,
            GetLaunchProgressEmitter,
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

    // Ingest de progresso de lançamento vindo do app (electron-main) por POST.
    const LaunchProgress = (data) => ReportLaunchProgress(data)

    // Stream de progresso de lançamento: envia o snapshot atual e, em seguida,
    // cada novo estado. O listener é removido quando o ws fecha.
    const LaunchProgressStream = (ws) => {
        const _safeSend = (state) => {
            try { ws.send(JSON.stringify(state)) } catch(e){}
        }
        try { GetLaunchProgressSnapshot().forEach(_safeSend) } catch(e){}
        const onProgress = (state) => _safeSend(state)
        GetLaunchProgressEmitter().on("LAUNCH_PROGRESS", onProgress)
        ws.on && ws.on("close", () => {
            try { GetLaunchProgressEmitter().removeListener("LAUNCH_PROGRESS", onProgress) } catch(e){}
        })
    }

    const controllerServiceObject = {
        controllerName : "EcosystemManagerController",
        RunPackage,
        StopPackage,
        ListPackages: ListSupervisedPackages,
        PackageList,
        LaunchProgress,
        LaunchProgressStream
    }

    return Object.freeze(controllerServiceObject)
}


module.exports = EcosystemManagerController