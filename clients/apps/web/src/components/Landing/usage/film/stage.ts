import gsap from 'gsap'
import { el } from './kit'
import { builders, type Scene, type SceneCtx } from './scenes'

/**
 * The film's engine (films/metering-video/src/engine/stage.ts, without sound or video clips): every scene gets
 * a layer and its own gsap timeline, placed on one master timeline; scenes draw through `onFrame`, run from the
 * master's onUpdate, so any moment is exact whether playing, seeking or looping.
 */
export interface Stage {
  master: gsap.core.Timeline
  duration: number
  seek(t: number): void
}

export function buildStage(
  root: HTMLElement,
  storyboard: Scene[],
  W: number,
  H: number,
  mono: string,
  post?: (t: number) => void,
): Stage {
  const master = gsap.timeline({ paused: true, repeat: -1 })
  const hooks: { start: number; end: number; fn: (t: number) => void }[] = []
  let cursor = 0

  storyboard.forEach((cfg, i) => {
    const dur = cfg.duration
    const start = Math.max(0, cursor - (cfg.overlap ?? 0))
    const end = start + dur
    // later scenes sit on top
    const node = el(
      'div',
      `absolute inset-0 overflow-hidden ${i ? 'z-[12]' : 'z-[10]'}`,
      root,
    )
    node.dataset.scene = cfg.id
    const ctx: SceneCtx = {
      el: node,
      dur,
      W,
      H,
      mono,
      onFrame: (fn) => hooks.push({ start, end, fn }),
    }
    if (cfg.type === 'world') builders.world(ctx, cfg)
    else builders.curtain(ctx, cfg)
    master.add(gsap.timeline(), start)
    cursor = Math.max(cursor, end)
  })

  // pad so the master timeline is exactly as long as the storyboard
  master.set({}, {}, cursor)

  const runHooks = () => {
    const t = master.time()
    for (const h of hooks) if (t >= h.start && t <= h.end) h.fn(t - h.start)
    post?.(t)
  }
  master.eventCallback('onUpdate', runHooks)
  master.eventCallback('onRepeat', runHooks)

  const seek = (t: number) => {
    master.time(Math.min(Math.max(t, 0), cursor))
    runHooks()
  }
  seek(0)
  return { master, duration: cursor, seek }
}
