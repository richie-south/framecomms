import {queueHandler} from './queue-handler'
import {onFrameLoadedEvent, onSubscriberEvent} from './constants'
import {createEvents} from './events'
import {getId} from './generate-uniq-id'
import {createRpcHandler} from './rpc'
import {
  callFnMessage,
  CallFnMessage,
  connectedMessage,
  ConnectedMessage,
  connectMessage,
  emitMessage,
  EmitMessage,
  EmitMessagePublisher,
  Events,
  pingMessage,
  PingMessage,
  pongMessage,
  responseMessage,
  ResponseMessage,
  updateGlobalsMessage,
  UpdateGlobalsMessage,
} from './types/post-messages'
import {Attributes, Available, GetContainer, Options} from './types/types'
const iframeLoaded = '3q6vOw'

function _parseGlobals(available: Available) {
  return Object.fromEntries(
    Object.entries(available ?? {}).filter(
      ([, value]) => typeof value !== 'function',
    ),
  )
}

function _setUpIframe(
  src: string,
  attributes: Attributes,
  getContainer?: GetContainer,
  options?: Options,
) {
  const uid = `uid_framecomms_${getId()}`
  const iframe = document.createElement('iframe')

  if (attributes && attributes.iframe) {
    Object.keys(attributes.iframe).forEach((key) => {
      iframe.setAttribute(key, attributes.iframe[key])
    })
  }

  iframe.setAttribute('frameborder', '0')
  iframe.setAttribute('src', src)
  iframe.setAttribute('id', uid)

  const origin = options.origin ?? new URL(iframe?.src || '').origin

  const fragment = document.createDocumentFragment()
  if (getContainer) {
    fragment.appendChild(
      getContainer({
        uid,
        iframe,
      }),
    )
  } else {
    fragment.appendChild(iframe)
  }

  return {
    fragment,
    iframe,
    origin,
    uid,
  }
}

export function createIframe({
  id,
  src,
  attributes,
  available,
  container,
  options,
}: {
  id: string
  src: string
  attributes?: Attributes
  available?: Available
  container?: GetContainer
  options?: Options
}) {
  let globals = _parseGlobals(available)
  const {fragment, iframe, origin} = _setUpIframe(
    src,
    attributes,
    container,
    options,
  )

  const rpc = createRpcHandler()
  const callQueue = queueHandler()
  const events = createEvents()
  const subscribers: string[] = []
  let hasIframeLoaded = false

  iframe.addEventListener('load', () => {
    hasIframeLoaded = true
    _emitNoQueue(onFrameLoadedEvent)
    rpc.handle({
      key: iframeLoaded,
      payload: '',
    })
  })

  const _post = (message: Events, o = origin) => {
    iframe?.contentWindow?.postMessage(message, o)
  }

  const _onEvent = async (event: MessageEvent<Events>) => {
    if (!event.data || event.data?.id !== id) {
      return
    }

    if (event.data?.type === connectMessage) {
      subscribers.push(event.data.payload as string)

      const message: ConnectedMessage<typeof globals> = {
        type: connectedMessage,
        id,
        reqId: event.data.reqId,
        origin,
        payload: globals,
      }

      if (hasIframeLoaded) {
        _post(message)
        callQueue.flush(_post)
        emit(onSubscriberEvent)
      } else {
        rpc.register({
          key: iframeLoaded,
          onHandle: async () => {
            _post(message)
            callQueue.flush(_post)
            emit(onSubscriberEvent)
          },
        })
      }

      return
    }

    if (!subscribers.includes(event.data['subscriberId'])) {
      return
    }

    if (event.data?.type === pongMessage) {
      rpc.handle({
        key: `${pongMessage}:${event.data.subscriberId}`,
        payload: '',
      })
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
              payload: response,
            }
            _post(message, '*')
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

    if (event.data.type === emitMessage) {
      const incoming = event.data as EmitMessage
      const message: EmitMessage = {
        type: emitMessage,
        id,
        reqId: incoming.reqId,
        event: incoming.event,
        subscriberId: incoming.subscriberId,
        payload: incoming.payload,
      }
      _post(message)
      events.handle(event.data.event, event.data.payload)
      return
    }
  }

  const _ping = () => {
    setInterval(() => {
      if (subscribers.length === 0) {
        return
      }

      subscribers.map((subscriberId) => {
        const time = setTimeout(() => {
          rpc.deregister(`${pongMessage}:${subscriberId}`)
        }, 1000)

        rpc.register({
          key: `${pongMessage}:${subscriberId}`,
          onHandle: async () => {
            clearTimeout(time)
            rpc.deregister(`${pongMessage}:${subscriberId}`)
          },
        })

        const message: PingMessage = {
          type: pingMessage,
          id,
          reqId: subscriberId,
        }

        _post(message)
      })
    }, 40_000)
  }

  const render = (query: string) => {
    return window.document.querySelector(query).appendChild(fragment)
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
      }

      if (subscribers.length === 0) {
        callQueue.add(message)
        return
      }

      _post(message)
    })
  }

  const addAvailable = (newAvailable: Available) => {
    available = {
      ...available,
      ...newAvailable,
    }

    globals = _parseGlobals(available)

    const message: UpdateGlobalsMessage<typeof globals> = {
      type: updateGlobalsMessage,
      id,
      payload: globals,
    }

    _post(message)
  }

  const _emitNoQueue = (event: string, payload?: unknown) => {
    const message: EmitMessagePublisher = {
      type: emitMessage,
      id,
      event,
      payload: payload,
    }

    events.handle(event, payload)
    _post(message)
  }

  const emit = (event: string, payload?: unknown) => {
    const message: EmitMessagePublisher = {
      type: emitMessage,
      id,
      event,
      payload: payload,
    }
    events.handle(event, payload)

    if (subscribers.length === 0) {
      callQueue.add(message)
      return
    }

    _post(message)
  }

  const on = <T = unknown>(
    event: string,
    callback: (params?: unknown) => Promise<T>,
  ) => {
    events.register(event, callback)
  }

  window.addEventListener('message', _onEvent, false)
  _ping()

  return {
    render,
    call,
    emit,
    on,
    addAvailable,
  }
}
