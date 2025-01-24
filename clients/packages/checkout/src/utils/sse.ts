import {
  type EventSourceController,
  type EventSourceHooks,
  EventSourcePlus,
} from 'event-source-plus'
import EventEmitter from 'eventemitter3'

export const createSSEListener = (
  url: string,
): [EventEmitter, () => EventSourceController] => {
  const events = new EventEmitter()
  const eventSource = new EventSourcePlus(url, {
    credentials: 'include',
  })
  const hooks: EventSourceHooks = {
    onMessage: async (message) => {
      const data = JSON.parse(message.data)
      events.emit(data.key, data.payload)
    },
  }

  const listen = () => {
    return eventSource.listen(hooks)
  }

  return [events, listen]
}
