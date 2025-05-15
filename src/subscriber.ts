import {callQueueHandler} from './call-queue'
import {onConnectedEvent} from './constants'
import {createEvents} from './events'
import {getId} from './generate-uniq-id'
import {createRpcHandler} from './rpc'
import {
  callFnMessage,
  CallFnMessage,
  connectedMessage,
  connectMessage,
  ConnectMessage,
  emitMessage,
  EmitMessage,
  Events,
  pingMessage,
  pongMessage,
  PongMessage,
  responseMessage,
  ResponseMessage,
  updateGlobalsMessage,
} from './types/post-messages'
import {Available} from './types/types'

export function connectTo({
  id,
  available = {},
}: {
  id: string
  available?: Available
}) {
  const subscriberId = getId()
  const rpc = createRpcHandler()
  const events = createEvents()
  const callQueue = callQueueHandler()
  let isConnected: boolean = false
  let origin: string = '*'

  const _post = (message: Events, o = origin) => {
    parent.postMessage(message, o)
  }

  const _onEvent = async (event: MessageEvent<Events>) => {
    if (!event.data || event.data?.id !== id) {
      return
    }

    if (event.data.type === connectedMessage) {
      origin = event.data.origin

      rpc.handle({
        key: event.data.reqId,
        payload: event.data.payload,
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
      const message: PongMessage = {
        type: pongMessage,
        id,
        reqId: event.data.reqId,
        subscriberId,
      }
      _post(message)
      return
    }

    if (event.data?.type === callFnMessage) {
      const availableKeys = Object.keys(available)
      if (availableKeys.includes(event.data.method)) {
        const handler = available[event.data.method]

        if (typeof handler === 'function') {
          try {
            const response = await handler(event.data.payload)
            const message: ResponseMessage<typeof response> = {
              type: responseMessage,
              id,
              reqId: event.data.reqId,
              subscriberId,
              payload: response,
            }

            _post(message)
          } catch (error) {}
        }

        return
      }
    }

    if (event.data.type === responseMessage) {
      rpc.handle({
        key: event.data.reqId,
        payload: event.data.payload,
      })
      return
    }

    if (event.data.type === updateGlobalsMessage) {
      window.framecommsProps = event.data.payload
      return
    }

    if (event.data.type === emitMessage) {
      events.handle(event.data.event, event.data.payload)
      return
    }
  }

  const _connect = () => {
    return new Promise((resolve, reject) => {
      const reqId = getId()

      rpc.register({
        key: reqId,
        onHandle: async (payload) => {
          isConnected = true
          window.framecommsProps = payload
          events.handle(onConnectedEvent, payload)
          callQueue.flush(_post)

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

      _post(message)
    })
  }

  const call = <T = unknown>(method: string, payload?: unknown): Promise<T> => {
    return new Promise((resolve, reject) => {
      const reqId = getId()

      rpc.register({
        key: reqId,
        onHandle: async (value) => resolve(value as T),
        onDeregister: () => reject(new Error(`No reponse ${method}`)),
      })

      const message: CallFnMessage<typeof payload> = {
        type: callFnMessage,
        id,
        reqId,
        method,
        payload,
        subscriberId,
      }

      if (!isConnected) {
        callQueue.add(message)
        return
      }

      _post(message, '*')
    })
  }

  const on = <T = unknown>(
    event: string,
    callback: (params?: unknown) => Promise<T>,
  ) => {
    events.register(event, callback)

    if (event === connectedMessage && isConnected) {
      events.handle(event, {})
    }
  }

  const removeListener = (event: string) => {
    events.deregister(event)
  }

  const emit = (event: string, payload: unknown) => {
    const reqId = getId()

    const message: EmitMessage<typeof payload> = {
      type: emitMessage,
      id,
      reqId,
      event,
      subscriberId,
      payload,
    }

    if (!isConnected) {
      callQueue.add(message)
      return
    }

    _post(message)
  }

  const addAvailable = () => (newAvailable: Available) => {
    available = {
      ...available,
      ...newAvailable,
    }
  }

  window.addEventListener('message', _onEvent, false)
  _connect()

  return {
    call,
    on,
    removeListener,
    emit,
    addAvailable,
  }
}
