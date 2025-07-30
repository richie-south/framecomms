type Method = (params?: unknown) => void

export function createEvents() {
  const methods = new Map<string, Method[]>()

  const register = (key: string, fn: Method) => {
    methods.set(key, [...(methods.get(key) ?? []), fn])
  }

  const deregister = (methodName: string) => {
    const existed = methods.delete(methodName)
    return existed
  }

  const handle = (key: string, payload?: unknown) => {
    const fns = methods.get(key)

    if (Array.isArray(fns)) {
      fns.forEach((fn) => {
        try {
          fn(payload)
        } catch (error) {
          // slient
        }
      })
    }
  }

  return {register, deregister, handle}
}
