import {queueHandler} from './queue-handler'
import {onConnectedEvent, onConnectFailedEvent} from './constants'
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
import {Available, FrameGlobal} from './types/types'

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
  const callQueue = queueHandler()
  let isConnected: boolean = false
  let origin: string = '*'
  let globals: FrameGlobal = {}

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
      globals = event.data.payload
      return
    }

    if (event.data.type === emitMessage) {
      events.handle(event.data.event, event.data.payload)
      return
    }
  }

  const _connect = () => {
    const reqId = getId()

    rpc.register({
      key: reqId,
      onHandle: async (payload: FrameGlobal) => {
        isConnected = true
        globals = payload
        events.handle(onConnectedEvent, payload)
        callQueue.flush(_post)
      },
      onDeregister: () => {
        events.handle(onConnectFailedEvent, id)
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

      _post(message)
    })
  }

  const on = <T = unknown>(event: string, callback: (params?: T) => void) => {
    events.register(event, callback)

    if (event === connectedMessage && isConnected) {
      events.handle(event, {})
    }
  }

  const removeListener = (event: string) => {
    events.deregister(event)
  }

  const emit = (event: string, payload?: unknown) => {
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

  const addAvailable = (newAvailable: Available) => {
    available = {
      ...available,
      ...newAvailable,
    }
  }

  const get = <T>(key: keyof T): T[keyof T] | undefined => {
    try {
      return (globals as unknown as T)[key]
    } catch {
      return undefined
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
    get,
  }
}
