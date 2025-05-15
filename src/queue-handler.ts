import {Events} from './types/post-messages'

export function queueHandler() {
  let callQueue: Events[] = []

  const add = (event: Events) => {
    callQueue.push(event)
  }

  const flush = (callback: (event: Events) => void) => {
    callQueue.forEach((event) => callback(event))
    callQueue = []
  }

  return {
    add,
    flush,
  }
}
