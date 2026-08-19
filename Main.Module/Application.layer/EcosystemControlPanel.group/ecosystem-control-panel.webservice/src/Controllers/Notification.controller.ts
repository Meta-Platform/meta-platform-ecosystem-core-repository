const NotificationController = (params: any) => {

    const {
        notificationHubService
    } = params

    /*
        A desinscricao no fechamento e o que impede o hub de acumular conexoes
        mortas. Sem ela, cada aba aberta, cada recarga de painel e cada
        reconexao somava um ouvinte imortal segurando o `ws` morto — e dai em
        diante todo evento tentava `send` nele, tomava excecao e logava. Foi o
        que levou o host-agent a 1,87 GiB e o log dele a 13,9 MB (19/08/2026).

        Ouve "close" e "error": um socket que morre por erro nem sempre emite
        "close" depois, e ficar so no "close" deixaria justamente os casos ruins
        acumulando.
    */
    const StreamNotifications = (ws: any) => {

        const { RegisterNotificationListener } = notificationHubService

        const Desinscrever = RegisterNotificationListener((event: any) => {
            try{
                ws.send(JSON.stringify(event))
            }catch(e: any){
                Log.error("Notification", e)
            }
        })

        let encerrado = false
        const Encerrar = () => {
            if(encerrado) return
            encerrado = true
            // Pode nao existir se o hub for uma versao antiga sem desinscricao.
            if(typeof Desinscrever === "function") Desinscrever()
        }
        ws.on("close", Encerrar)
        ws.on("error", Encerrar)
    }

    return {
        controllerName : "NotificationController",
        StreamNotifications
    }
}

module.exports = NotificationController