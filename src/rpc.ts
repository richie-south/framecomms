type RpcMethod = (params: unknown) => Promise<unknown>

type RpcRegister = {
  key: string
  onHandle: RpcMethod
  onDeregister?: () => void
}

interface RpcRequest {
  key: string
  payload: unknown
}

interface RpcResponse {
  result?: unknown
  key?: string
  error?: string
}

export function createRpcHandler() {
  const methods = new Map<string, RpcRegister>()
  const timers = new Map<string, NodeJS.Timeout>()

  const _clearTimer = (methodName: string) => {
    const existing = timers.get(methodName)

    if (existing) {
      clearTimeout(existing)
      timers.delete(methodName)
    }
  }

  const _setAutoDeregisterTimer = (methodName: string) => {
    _clearTimer(methodName)

    const timeout = setTimeout(() => {
      deregister(methodName)
    }, 60_000)

    timers.set(methodName, timeout)
  }

  const register = (register: RpcRegister) => {
    methods.set(register.key, register)
    _setAutoDeregisterTimer(register.key)
  }

  const deregister = (methodName: string) => {
    const register = methods.get(methodName)

    if (register && register.onDeregister) {
      try {
        register.onDeregister()
      } catch (err: any) {
        // silent
      }
    }

    const existed = methods.delete(methodName)
    _clearTimer(methodName)
    return existed
  }

  const handle = async ({key, payload}: RpcRequest): Promise<RpcResponse> => {
    const register = methods.get(key)

    if (!register || !register.onHandle) {
      return {error: `Method "${key}" not found.`}
    }

    _clearTimer(key)
    methods.delete(key)

    try {
      const result = await register.onHandle(payload)
      return {result, key}
    } catch (err) {
      return {error: err?.message ?? 'Unknown error'}
    }
  }

  return {register, deregister, handle}
}
