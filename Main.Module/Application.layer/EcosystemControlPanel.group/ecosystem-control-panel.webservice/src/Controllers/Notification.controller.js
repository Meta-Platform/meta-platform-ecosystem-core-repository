const NotificationController = (params) => {

    const {
        notificationHubService
    } = params

    const StreamNotifications = (ws) => {

        const { RegisterNotificationListener } = notificationHubService

        RegisterNotificationListener((event) => {
            try{
                ws.send(JSON.stringify(event))
            }catch(e){
                console.log(e)
            }
        })
    }

    return {
        controllerName : "NotificationController",
        StreamNotifications
    }
}

module.exports = NotificationController