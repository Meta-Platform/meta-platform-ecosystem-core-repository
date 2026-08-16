const NotificationController = (params: any) => {

    const {
        notificationHubService
    } = params

    const StreamNotifications = (ws: any) => {

        const { RegisterNotificationListener } = notificationHubService

        RegisterNotificationListener((event: any) => {
            try{
                ws.send(JSON.stringify(event))
            }catch(e: any){
                Log.error("Notification", e)
            }
        })
    }

    return {
        controllerName : "NotificationController",
        StreamNotifications
    }
}

module.exports = NotificationController