const EventEmitter = require('node:events')

const GetLocalISODateTime = () => {
	const now = new Date()
	const offset = now.getTimezoneOffset() * 60000
	return  (new Date(now.getTime() - offset)).toISOString()
}

const NotificationHubService = (params: any) => {
    
    const eventEmitter = new EventEmitter()
    const EVENT_NOTIFICATION = Symbol()

    const {
        onReady 
    } = params

    const _Start = async () => {

        onReady()   
    }

    const NotifyEvent = (event: any) =>
        eventEmitter.emit(EVENT_NOTIFICATION, {date: GetLocalISODateTime(), ...event})

    _Start()

    const RegisterNotificationListener = (f: any) => 
        eventEmitter.on(EVENT_NOTIFICATION, (event: any) => f(event))

    return {
        RegisterNotificationListener,
        NotifyEvent
    }

}

module.exports = NotificationHubService