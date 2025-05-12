import {createEvents} from './events'
import {generateUniqId} from './generate-uniq-id'
import {createRpcHandler} from './rpc'
import {
  CallFnMessage,
  callFnMessage,
  ConnectedMessage,
  connectedMessage,
  connectMessage,
  ConnectMessage,
  emitMessage,
  EmitMessage,
  Events,
  PingMessage,
  pingMessage,
  pongMessage,
  PongMessage,
  responseMessage,
  ResponseMessage,
  updateGlobalsMessage,
  UpdateGlobalsMessage,
} from './types/post-messages'
import {Available} from './types/types'

export function connectToIframe({
  id,
  available,
}: {
  id: string
  available?: Available
}) {
  const subscriberId = generateUniqId.rnd()

  let isConnected = false
  const rpc = createRpcHandler()
  const events = createEvents()
  let origin = '*'

  const onEvent = async (event: MessageEvent<Events>) => {
    if (!event.data || event.data?.id !== id) {
      return
    }

    if (event.data.type === connectedMessage) {
      const incoming = event.data as unknown as ConnectedMessage
      origin = event.origin

      rpc.handle({
        key: incoming.reqId,
        payload: incoming.payload,
      })

      return
    }

    if (!isConnected) {
      return
    }

    if (!event.data || event.data?.id !== id) {
      return
    }

    if (event.data?.type === pingMessage && event.data.reqId === subscriberId) {
      const incoming = event.data as unknown as PingMessage

      const message: PongMessage = {
        type: pongMessage,
        id,
        reqId: incoming.reqId,
        subscriberId,
      }
      parent.postMessage(message, origin)
      return
    }

    if (event.data?.type === callFnMessage) {
      const incoming = event.data as unknown as CallFnMessage

      const availableKeys = Object.keys(available)
      if (availableKeys.includes(incoming.method)) {
        const handler = available[incoming.method]

        if (typeof handler === 'function') {
          try {
            const response = await handler(incoming.payload)
            const message: ResponseMessage<typeof response> = {
              type: responseMessage,
              id,
              reqId: event.data.reqId,
              subscriberId,
              payload: response,
            }

            parent.postMessage(message, origin)
          } catch (error) {}
        }

        return
      }
    }

    if (event.data.type === responseMessage) {
      const incoming = event.data as unknown as ResponseMessage
      rpc.handle({
        key: incoming.reqId,
        payload: incoming.payload,
      })
      return
    }

    if (event.data.type === updateGlobalsMessage) {
      const incoming = event.data as unknown as UpdateGlobalsMessage
      // TODO: handle this as a get function instead of poluting window
      window.framecommsProps = incoming.payload
      return
    }

    if (event.data.type === emitMessage) {
      const incoming = event.data as unknown as EmitMessage
      events.handle(incoming.event, incoming.payload)

      return
    }
  }

  const call = (method: string, payload?: any) => {
    return new Promise((resolve, reject) => {
      if (!isConnected) {
        // TODO: send this when connected?
        return reject(new Error('Not connected'))
      }

      const reqId = generateUniqId.rnd()

      rpc.register({
        key: reqId,
        onHandle: async (returnParams) => {
          resolve(returnParams)
        },
        onDeregister: () => {
          reject(new Error(`No reponse ${method}`))
        },
      })

      const message: CallFnMessage<typeof payload> = {
        type: callFnMessage,
        id,
        reqId,
        method,
        payload,
        subscriberId,
      }

      parent.postMessage(message, '*')
    })
  }

  const connect = () => {
    return new Promise((resolve, reject) => {
      const reqId = generateUniqId.rnd()

      rpc.register({
        key: reqId,
        onHandle: async (payload) => {
          isConnected = true
          window.framecommsProps = payload

          events.handle(connectedMessage, payload)
          resolve(true)
        },
        onDeregister: () => {
          reject(new Error('Could not connect'))
        },
      })

      const message: ConnectMessage<typeof subscriberId> = {
        type: connectMessage,
        id,
        reqId,
        subscriberId,
        payload: subscriberId,
      }

      parent.postMessage(message, origin)
    })
  }

  const on = (event: string, callback: (params: any) => Promise<any>) => {
    events.register(event, callback)

    if (event === connectedMessage && isConnected) {
      events.handle(event, {})
    }
  }

  const removeListener = (event: string) => {
    events.deregister(event)
  }

  const emit = (event: string, payload: any) => {
    const reqId = generateUniqId.rnd()

    const message: EmitMessage<typeof payload> = {
      type: emitMessage,
      id,
      reqId,
      event,
      subscriberId,
      payload,
    }

    parent.postMessage(message, origin)
  }

  window.addEventListener('message', onEvent, false)

  connect()

  return {
    call,
    on,
    removeListener,
    emit,
    addAvailable: (newAvailable: Available) => {
      available = {
        ...available,
        ...newAvailable,
      }
    },
  }
}
