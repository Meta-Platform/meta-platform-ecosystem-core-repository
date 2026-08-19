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

    /*
        Devolve a função que CANCELA a inscrição — e é obrigação de quem se
        inscreve chamá-la.

        Antes isto não existia, e não existia por dois motivos somados: o
        emitter recebia um wrapper anônimo (`(event) => f(event)`), então nem
        `off(f)` funcionaria, e nada era devolvido para desfazer. Todo ouvinte
        registrado ficava para sempre.

        O efeito medido em 19/08/2026: os três controllers que consomem este hub
        registram um ouvinte por conexão de WebSocket, e nenhum desinscrevia ao
        fechar. Cada aba aberta, cada recarga de painel, cada reconexão somava um
        ouvinte imortal que segurava o `ws` morto. Daí para frente TODO evento
        percorria também os mortos, chamava `ws.send` neles, tomava exceção e
        logava — o log do host-agent chegou a 13,9 MB, e o processo a 1,87 GiB,
        crescendo com a ATIVIDADE e parado em repouso, que é a assinatura exata
        deste defeito.

        O ouvinte vai direto para o emitter, sem wrapper, para que `off` case.
    */
    const RegisterNotificationListener = (f: any) => {
        eventEmitter.on(EVENT_NOTIFICATION, f)
        return () => eventEmitter.off(EVENT_NOTIFICATION, f)
    }

    return {
        RegisterNotificationListener,
        NotifyEvent
    }

}

module.exports = NotificationHubService