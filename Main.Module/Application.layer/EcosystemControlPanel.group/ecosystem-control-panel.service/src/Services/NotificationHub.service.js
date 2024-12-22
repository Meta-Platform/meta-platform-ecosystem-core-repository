const EventEmitter = require('node:events')

const NotificationHubService = (params) => {
    
    const eventEmitter = new EventEmitter()
    const EVENT_NOTIFICATION = Symbol()

    const {
        onReady 
    } = params

    const _Start = async () => {

        onReady()   
    }

    const NotifyEvent = (event) =>
        eventEmitter.emit(EVENT_NOTIFICATION, event)

    _Start()

    const RegisterNotificationListener = (f) => 
        eventEmitter.on(EVENT_NOTIFICATION, (event) => f(event))

    return {
        RegisterNotificationListener,
        NotifyEvent
    }

}

module.exports = NotificationHubService