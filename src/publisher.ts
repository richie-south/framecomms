import {getId} from './generate-uniq-id'
import {createRpcHandler} from './rpc'
import {
  CallFnMessage,
  callFnMessage,
  connectedMessage,
  ConnectedMessage,
  connectMessage,
  EmitMessage,
  emitMessage,
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
      ([key, value]) => typeof value !== 'function',
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
  const subscribers: string[] = []
  let hasIframeLoaded = false

  iframe.addEventListener('load', () => {
    hasIframeLoaded = true
    rpc.handle({
      key: iframeLoaded,
      payload: '',
    })
  })

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
        iframe?.contentWindow?.postMessage(message, origin)
      } else {
        rpc.register({
          key: iframeLoaded,
          onHandle: async () => {
            iframe?.contentWindow?.postMessage(message, origin)
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
            iframe?.contentWindow?.postMessage(message, '*')
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
      const message: EmitMessage = {
        type: emitMessage,
        id,
        reqId: event.data.reqId,
        event: event.data.event,
        subscriberId: event.data.subscriberId,
        payload: event.data.payload,
      }
      iframe?.contentWindow?.postMessage(message, origin)
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

        iframe?.contentWindow?.postMessage(message, origin)
      })
    }, 40_000)
  }

  const render = (query: string) => {
    return window.document.querySelector(query).appendChild(fragment)
  }

  const call = (method: string, payload: unknown) => {
    return new Promise((resolve, reject) => {
      const reqId = getId()

      rpc.register({
        key: reqId,
        onHandle: async (resurnParams) => {
          resolve(resurnParams)
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
      }

      iframe?.contentWindow?.postMessage(message, origin)
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

    iframe?.contentWindow?.postMessage(message, origin)
  }

  const emit = (event: string, payload: unknown) => {
    const message: EmitMessagePublisher = {
      type: emitMessage,
      id,
      event,
      payload: payload,
    }
    iframe?.contentWindow?.postMessage(message, origin)
  }

  window.addEventListener('message', _onEvent, false)
  _ping()

  return {
    render,
    call,
    emit,
    addAvailable,
  }
}
