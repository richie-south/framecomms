type EventHandler<T = unknown> = (payload?: T) => void

interface EventData {
  handler: EventHandler
  once: boolean
}

export function createEvents() {
  const events = new Map<string, EventData[]>()

  function addEventListener(
    key: string,
    handler: EventHandler,
    options?: {once?: boolean},
  ) {
    const existing = events.get(key) ?? []
    existing.push({handler, once: !!options?.once})
    events.set(key, existing)
  }

  function removeEventListener(key: string, handler: EventHandler) {
    const existing = events.get(key)
    if (!existing) return

    const filtered = existing.filter((listener) => listener.handler !== handler)
    if (filtered.length > 0) {
      events.set(key, filtered)
    } else {
      events.delete(key)
    }
  }

  function dispatchEvent<T = unknown>(key: string, payload?: T) {
    const listeners = events.get(key)
    if (!listeners) return

    const toCall = [...listeners]

    for (const {handler, once} of toCall) {
      try {
        handler(payload)
      } catch {}

      if (once) {
        removeEventListener(key, handler)
      }
    }
  }

  function removeAllListeners(key?: string) {
    if (key) events.delete(key)
    else events.clear()
  }

  return {
    addEventListener,
    removeEventListener,
    dispatchEvent,
    removeAllListeners,
  }
}
