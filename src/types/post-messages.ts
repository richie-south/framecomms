export const callFnMessage = '@FRAMECOMMS/callfn'

export interface CallFnMessage<TPayload = unknown> {
  type: typeof callFnMessage
  id: string
  reqId: string
  method: string
  payload: TPayload
  subscriberId?: string
}

export const responseMessage = '@FRAMECOMMS/response'

export interface ResponseMessage<TPayload = unknown> {
  type: typeof responseMessage
  id: string
  reqId: string
  payload: TPayload
  subscriberId?: string
}

export const connectMessage = '@FRAMECOMMS/connect'

export interface ConnectMessage<TPayload = unknown> {
  type: typeof connectMessage
  id: string
  reqId: string
  payload: TPayload
  subscriberId?: string
}

export const connectedMessage = '@FRAMECOMMS/connected'

export interface ConnectedMessage<TPayload = unknown> {
  type: typeof connectedMessage
  id: string
  reqId: string
  origin: string
  payload: TPayload
  subscriberId?: string
}

export const pingMessage = '@FRAMECOMMS/ping'

export interface PingMessage {
  type: typeof pingMessage
  id: string
  reqId: string
}

export const pongMessage = '@FRAMECOMMS/pong'

export interface PongMessage {
  type: typeof pongMessage
  id: string
  reqId: string
  subscriberId: string
}

export const updateGlobalsMessage = '@FRAMECOMMS/updateglobals'

export interface UpdateGlobalsMessage<TPayload = unknown> {
  type: typeof updateGlobalsMessage
  id: string
  payload: TPayload
}

export const emitMessage = '@FRAMECOMMS/emit'

export interface EmitMessage<TPayload = unknown> {
  type: typeof emitMessage
  id: string
  reqId: string
  event: string
  subscriberId?: string
  payload: TPayload
}

export interface EmitMessagePublisher<TPayload = unknown> {
  type: typeof emitMessage
  id: string
  event: string
  payload: TPayload
}

export type Events =
  | CallFnMessage
  | ResponseMessage
  | ConnectMessage
  | ConnectedMessage
  | PingMessage
  | PongMessage
  | UpdateGlobalsMessage
  | EmitMessage
