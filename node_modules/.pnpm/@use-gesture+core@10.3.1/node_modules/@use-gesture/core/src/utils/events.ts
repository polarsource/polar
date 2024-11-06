import { PointerType } from '../types'
import { Vector2 } from '../types'

const EVENT_TYPE_MAP: any = {
  pointer: { start: 'down', change: 'move', end: 'up' },
  mouse: { start: 'down', change: 'move', end: 'up' },
  touch: { start: 'start', change: 'move', end: 'end' },
  gesture: { start: 'start', change: 'change', end: 'end' }
}

function capitalize(string: string) {
  if (!string) return ''
  return string[0].toUpperCase() + string.slice(1)
}

const actionsWithoutCaptureSupported = ['enter', 'leave']

function hasCapture(capture = false, actionKey: string) {
  return capture && !actionsWithoutCaptureSupported.includes(actionKey)
}

export function toHandlerProp(device: string, action = '', capture: boolean = false) {
  const deviceProps = EVENT_TYPE_MAP[device]
  const actionKey = deviceProps ? deviceProps[action] || action : action
  return 'on' + capitalize(device) + capitalize(actionKey) + (hasCapture(capture, actionKey) ? 'Capture' : '')
}

const pointerCaptureEvents = ['gotpointercapture', 'lostpointercapture']

export function parseProp(prop: string) {
  let eventKey = prop.substring(2).toLowerCase()
  const passive = !!~eventKey.indexOf('passive')
  if (passive) eventKey = eventKey.replace('passive', '')

  const captureKey = pointerCaptureEvents.includes(eventKey) ? 'capturecapture' : 'capture'
  // capture = true
  const capture = !!~eventKey.indexOf(captureKey)
  // pointermovecapture => pointermove
  if (capture) eventKey = eventKey.replace('capture', '')
  return { device: eventKey, capture, passive }
}

export function toDomEventType(device: string, action = '') {
  const deviceProps = EVENT_TYPE_MAP[device]
  const actionKey = deviceProps ? deviceProps[action] || action : action
  return device + actionKey
}

export function isTouch(event: UIEvent) {
  return 'touches' in event
}

export function getPointerType(event: UIEvent): PointerType {
  if (isTouch(event)) return 'touch'
  if ('pointerType' in event) return (event as PointerEvent).pointerType as PointerType
  return 'mouse'
}

function getCurrentTargetTouchList(event: TouchEvent) {
  return Array.from(event.touches).filter(
    (e) => e.target === event.currentTarget || (event.currentTarget as Node)?.contains?.(e.target as Node)
  )
}

function getTouchList(event: TouchEvent) {
  return event.type === 'touchend' || event.type === 'touchcancel' ? event.changedTouches : event.targetTouches
}

function getValueEvent<EventType extends TouchEvent | PointerEvent>(
  event: EventType
): EventType extends TouchEvent ? Touch : PointerEvent {
  return (isTouch(event) ? getTouchList(event as TouchEvent)[0] : event) as any
}

export function distanceAngle(P1: Touch | PointerEvent, P2: Touch | PointerEvent) {
  // add a try catch
  // attempt to fix https://github.com/pmndrs/use-gesture/issues/551
  try {
    const dx = P2.clientX - P1.clientX
    const dy = P2.clientY - P1.clientY
    const cx = (P2.clientX + P1.clientX) / 2
    const cy = (P2.clientY + P1.clientY) / 2

    const distance = Math.hypot(dx, dy)
    const angle = -(Math.atan2(dx, dy) * 180) / Math.PI
    const origin = [cx, cy] as Vector2
    return { angle, distance, origin }
  } catch {}
  return null
}

export function touchIds(event: TouchEvent) {
  return getCurrentTargetTouchList(event).map((touch) => touch.identifier)
}

export function touchDistanceAngle(event: TouchEvent, ids: number[]) {
  const [P1, P2] = Array.from(event.touches).filter((touch) => ids.includes(touch.identifier))
  return distanceAngle(P1, P2)
}

export function pointerId(event: PointerEvent | TouchEvent) {
  const valueEvent = getValueEvent(event)
  return isTouch(event) ? (valueEvent as Touch).identifier : (valueEvent as PointerEvent).pointerId
}

export function pointerValues(event: PointerEvent | TouchEvent): Vector2 {
  // if ('spaceX' in event) return [event.spaceX, event.spaceY]
  const valueEvent = getValueEvent(event)
  return [valueEvent.clientX, valueEvent.clientY]
}

// wheel delta defaults from https://github.com/facebookarchive/fixed-data-table/blob/master/src/vendor_upstream/dom/normalizeWheel.js
const LINE_HEIGHT = 40
const PAGE_HEIGHT = 800

export function wheelValues(event: WheelEvent): Vector2 {
  let { deltaX, deltaY, deltaMode } = event
  // normalize wheel values, especially for Firefox
  if (deltaMode === 1) {
    deltaX *= LINE_HEIGHT
    deltaY *= LINE_HEIGHT
  } else if (deltaMode === 2) {
    deltaX *= PAGE_HEIGHT
    deltaY *= PAGE_HEIGHT
  }
  return [deltaX, deltaY]
}

export function scrollValues(event: UIEvent): Vector2 {
  // If the currentTarget is the window then we return the scrollX/Y position.
  // If not (ie the currentTarget is a DOM element), then we return scrollLeft/Top
  const { scrollX, scrollY, scrollLeft, scrollTop } = event.currentTarget as Element & Window
  return [scrollX ?? scrollLeft ?? 0, scrollY ?? scrollTop ?? 0]
}

export function getEventDetails(event: any) {
  const payload: any = {}
  if ('buttons' in event) payload.buttons = event.buttons
  if ('shiftKey' in event) {
    const { shiftKey, altKey, metaKey, ctrlKey } = event
    Object.assign(payload, { shiftKey, altKey, metaKey, ctrlKey })
  }
  return payload
}
