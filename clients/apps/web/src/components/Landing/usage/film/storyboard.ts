import type { Rect } from './kit'
import { SNAP, type Scene } from './scenes'

/**
 * THE STORYBOARD (films/metering-video/src/storyboard.ts, without its soundtrack)
 * Polar Metering, in light, as a loop: warm stone paper, near-black ink, Ether the one accent. The orbit's cloud of
 * usage in ink, its event chips riding it, and one square snapping round the frame as a magnifying glass that
 * decodes the chips into what they bill; it grows to half the frame, then the whole, and a curtain comes down over
 * the last two beats with the film's first frame above it, so it loops with no seam.
 */

export const video = { width: 1920, height: 1080 }

/** One beat (147 bpm, the cut's tempo), and the film in beats: 36 beats, about 14.7 seconds. */
const BEAT = 60 / 147
const beats = (n: number) => n * BEAT
const DONE = beats(36)

/** When the panel first scales up into the orbit, grows to the left half, then the whole frame. */
const PANELS_AT = beats(12)
const HALF_AT = PANELS_AT + beats(12)
const FULL_AT = HALF_AT + beats(6)
/** A layout snap lands its middle on the beat. */
const ON_CUT = SNAP / 2

/** The square roams as it snaps, each time opposite the last and against the cloud's turn. */
const ORBIT_A: Rect[] = [
  { x: 80, y: 60, w: 1000, h: 760 },
  { x: 880, y: 380, w: 960, h: 640 },
  { x: 980, y: 40, w: 860, h: 760 },
  { x: 90, y: 300, w: 720, h: 720 },
  { x: 700, y: 70, w: 1040, h: 500 },
  { x: 240, y: 120, w: 920, h: 680 },
]
const cycle = (shapes: Rect[], from: number, until: number, beat: number) => {
  const keys: { at: number; rect: Rect }[] = []
  for (let n = 1; from + n * beat < until - 0.3; n++)
    keys.push({ at: from + n * beat - ON_CUT, rect: shapes[n % shapes.length] })
  return keys
}
const shut = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2, w: 0, h: 0 })
const PANEL_A = [
  { at: PANELS_AT - ON_CUT, rect: shut(ORBIT_A[0]) },
  { at: PANELS_AT - ON_CUT, rect: ORBIT_A[0] },
  ...cycle(ORBIT_A, PANELS_AT, HALF_AT, beats(4)),
  { at: HALF_AT - ON_CUT, rect: { x: 0, y: 0, w: 960, h: 1080 } },
  { at: FULL_AT - ON_CUT, rect: { x: 0, y: 0, w: 1920, h: 1080 } },
]

export const theme = {
  paper: '#111111',
  grain: { amount: 0.045, size: 1.4, fps: 30, blend: 'normal' as const },
}

export const storyboard: Scene[] = [
  {
    id: 'world',
    type: 'world',
    duration: DONE,
    panels: [PANEL_A],
    lens: [[PANELS_AT - 0.3, DONE]],
    ink: [-1, DONE + 1],
    fieldUntil: DONE,
    tagsDuring: [0.12, DONE],
    spawn: { every: 0.42, life: 9 },
    tags: [
      { text: 'llm.completion', tone: 'ether', bill: '−480 credits' },
      { text: 'agent.step', tone: 'stone', bill: '−240 credits' },
      { text: 'image.render', tone: 'paper', bill: '€24.80' },
      { text: 'embedding.create', tone: 'tint', bill: '−120 credits' },
      { text: 'api.request', tone: 'stone', bill: '$1,240.00' },
      { text: 'tts.generate', tone: 'ink', bill: 'R$ 486.00' },
      { text: 'search.query', tone: 'tint', bill: '£312.50' },
      { text: 'video.render', tone: 'paper', bill: '¥48,000' },
      { text: 'code.execute', tone: 'ether', bill: '−360 credits' },
      { text: 'speech.transcribe', tone: 'stone', bill: 'SEK 2,940' },
      { text: 'vision.analyze', tone: 'tint', bill: 'CHF 186.40' },
      { text: 'agent.tool_call', tone: 'ink', bill: '−180 credits' },
      { text: 'image.upscale', tone: 'ether', bill: 'A$94.60' },
      { text: 'audio.dub', tone: 'ink', bill: '₹18,500' },
    ],
  },
  /* the loop: a curtain over the last two beats, the film's first frame above its edge */
  {
    id: 'loop',
    type: 'curtain',
    overlap: DONE,
    duration: DONE,
    at: DONE - beats(2),
  },
]
