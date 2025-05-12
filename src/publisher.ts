import {getId} from './generate-uniq-id'
import {createRpcHandler} from './rpc'
import {
  CallFnMessage,
  callFnMessage,
  connectedMessage,
  ConnectedMessage,
  ConnectMessage,
  connectMessage,
  EmitMessage,
  emitMessage,
  Events,
  pingMessage,
  PingMessage,
  PongMessage,
  pongMessage,
  responseMessage,
  ResponseMessage,
  updateGlobalsMessage,
  UpdateGlobalsMessage,
} from './types/post-messages'
import {Attributes, Available, GetContainer} from './types/types'
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

  const origin = new URL(iframe?.src || '').origin

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
}: {
  id: string
  src: string
  attributes?: Attributes
  available?: Available
  container?: GetContainer
}) {
  let globals = _parseGlobals(available)
  const {fragment, iframe, origin} = _setUpIframe(src, attributes, container)
  const rpc = createRpcHandler()
  const subscribers = []
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
      const incoming = event.data as unknown as ConnectMessage<string>
      subscribers.push(incoming.payload)

      const message: ConnectedMessage<typeof globals> = {
        type: connectedMessage,
        id,
        reqId: incoming.reqId,
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
      const incoming = event.data as unknown as PongMessage

      rpc.handle({
        key: `${pongMessage}:${incoming.subscriberId}`,
        payload: '',
      })
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
              payload: response,
            }
            iframe?.contentWindow?.postMessage(message, '*')
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

    if (event.data.type === emitMessage) {
      const incoming = event.data as unknown as EmitMessage
      const message: EmitMessage = {
        type: emitMessage,
        id,
        reqId: incoming.reqId,
        event: incoming.event,
        subscriberId: incoming.subscriberId,
        payload: incoming.payload,
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

  const call = (method: string, payload: any) => {
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

  window.addEventListener('message', _onEvent, false)
  _ping()

  return {
    render,
    call,
    addAvailable,
  }
}
