const EventEmitter = require('node:events')

const GetLocalISODateTime = () => {
	const now = new Date()
	const offset = now.getTimezoneOffset() * 60000
	return  (new Date(now - offset)).toISOString()
}

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
        eventEmitter.emit(EVENT_NOTIFICATION, {date: GetLocalISODateTime(), ...event})

    _Start()

    const RegisterNotificationListener = (f) => 
        eventEmitter.on(EVENT_NOTIFICATION, (event) => f(event))

    return {
        RegisterNotificationListener,
        NotifyEvent
    }

}

module.exports = NotificationHubService