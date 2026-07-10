const EcosystemManagerController = (params) => {

    const {
        ecosystemManagerService: {
            RunPackage,
            StopPackage,
            StopInstance,
            ListInstances,
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

    // Stream das instâncias lançadas por este daemon. Reage a DUAS fontes: as
    // tasks in-process (TASK_STATUS_CHANGE) e os processos desktop, que não são
    // tasks e só se manifestam pelo progresso de lançamento (LAUNCH_PROGRESS).
    const InstanceList = (ws) => {
        const _safeSend = async () => {
            try { ws.send(JSON.stringify(await ListInstances())) } catch(e){}
        }

        const taskEmitter   = GetTaskExecutorEventEmitter()
        const launchEmitter = GetLaunchProgressEmitter()

        taskEmitter.on("TASK_STATUS_CHANGE", _safeSend)
        launchEmitter.on("LAUNCH_PROGRESS", _safeSend)

        ws.on && ws.on("close", () => {
            try { taskEmitter.removeListener("TASK_STATUS_CHANGE", _safeSend) } catch(e){}
            try { launchEmitter.removeListener("LAUNCH_PROGRESS", _safeSend) } catch(e){}
        })

        _safeSend()
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
        StopInstance,
        ListInstances,
        InstanceList,
        ListPackages: ListSupervisedPackages,
        PackageList,
        LaunchProgress,
        LaunchProgressStream
    }

    return Object.freeze(controllerServiceObject)
}


module.exports = EcosystemManagerController