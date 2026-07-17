const EcosystemManagerController = (params) => {

    const {
        ecosystemManagerService: {
            RunPackage,
            StopPackage,
            StopInstance,
            ListInstances,
            ListInstanceTasks,
            ReportInstanceTasks,
            InstanceTaskStream,
            StopInstanceTasks,
            ListSupervisedPackages,
            ReportLaunchProgress,
            GetLaunchProgressSnapshot,
            GetLaunchProgressEmitter,
            GetInstancesEmitter
        }
    } = params

    // Stream da lista de pacotes supervisionados. Reage a mudanças na lista de
    // instâncias (lançou/encerrou algo → o estado "em execução" de um pacote muda).
    const PackageList = (ws) => {
        const _safeSend = async () => {
            try { ws.send(JSON.stringify(await ListSupervisedPackages())) } catch(e){}
        }
        const instancesEmitter = GetInstancesEmitter()
        instancesEmitter.on("INSTANCES_CHANGE", _safeSend)
        ws.on && ws.on("close", () => {
            try { instancesEmitter.removeListener("INSTANCES_CHANGE", _safeSend) } catch(e){}
        })
        _safeSend()
    }

    // Stream das instâncias lançadas por este daemon. Reage ao emissor DEDICADO
    // de mudanças de instância (lançou/encerrou) e ao progresso de lançamento
    // (fase transitória "launching", antes do registro assentar).
    const InstanceList = (ws) => {
        const _safeSend = async () => {
            try { ws.send(JSON.stringify(await ListInstances())) } catch(e){}
        }

        const instancesEmitter = GetInstancesEmitter()
        const launchEmitter     = GetLaunchProgressEmitter()

        instancesEmitter.on("INSTANCES_CHANGE", _safeSend)
        launchEmitter.on("LAUNCH_PROGRESS", _safeSend)

        ws.on && ws.on("close", () => {
            try { instancesEmitter.removeListener("INSTANCES_CHANGE", _safeSend) } catch(e){}
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
        ListInstanceTasks,
        ReportInstanceTasks,
        InstanceTaskStream,
        StopInstanceTasks,
        InstanceList,
        ListPackages: ListSupervisedPackages,
        PackageList,
        LaunchProgress,
        LaunchProgressStream
    }

    return Object.freeze(controllerServiceObject)
}


module.exports = EcosystemManagerController