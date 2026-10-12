/**
 * Replays the drawing of a page the way a drafting program would: guides and frames first, then every hairline
 * traced from its first anchor, then the filled parts, then the type. Runs on the elements the page has when it
 * arrives; whatever the live layers add later draws itself. `pace` stretches the whole replay: 1 is an ordinary
 * page, more is slower. Returns a cancel, for a page that leaves mid-stroke.
 */
export function construct(svg: SVGSVGElement, pace = 1): () => void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    return () => {}

  const guides: SVGElement[] = []
  const traces: SVGGeometryElement[] = []
  const fills: SVGElement[] = []
  const texts: SVGElement[] = []

  for (const el of svg.querySelectorAll<SVGElement>(
    'path, line, polyline, polygon, circle, ellipse, rect, text',
  )) {
    if (el.closest('defs, [data-live], [data-first]')) continue
    if (el instanceof SVGTextElement) {
      texts.push(el)
      continue
    }
    if (el.closest('[stroke-dasharray]')) {
      guides.push(el)
      continue
    }
    const style = getComputedStyle(el)
    if (style.stroke !== 'none' && el instanceof SVGGeometryElement)
      traces.push(el)
    else fills.push(el)
  }

  const anims: Animation[] = []
  const ease = 'cubic-bezier(0.2, 0.7, 0.2, 1)'
  const run = (
    el: Element,
    frames: Keyframe[],
    duration: number,
    delay: number,
  ) =>
    anims.push(
      el.animate(frames, {
        duration: duration * pace,
        delay: delay * pace,
        easing: ease,
        fill: 'backwards',
      }),
    )
  const spread = (i: number, n: number, from: number, over: number) =>
    from + (n > 1 ? (i / (n - 1)) * over : 0)

  guides.forEach((el, i) =>
    run(
      el,
      [{ opacity: 0 }, { opacity: 1 }],
      320,
      spread(i, guides.length, 0, 160),
    ),
  )
  traces.forEach((el, i) => {
    let length = 0
    try {
      length = el.getTotalLength()
    } catch {
      length = 0
    }
    const delay = spread(i, traces.length, 90, 560)
    if (length > 0)
      run(
        el,
        [
          {
            strokeDasharray: `${length}`,
            strokeDashoffset: length,
            fillOpacity: 0,
          },
          {
            strokeDasharray: `${length}`,
            strokeDashoffset: length * 0.25,
            fillOpacity: 0,
            offset: 0.6,
          },
          { strokeDasharray: `${length}`, strokeDashoffset: 0, fillOpacity: 1 },
        ],
        460,
        delay,
      )
    else run(el, [{ opacity: 0 }, { opacity: 1 }], 300, delay)
  })
  fills.forEach((el, i) =>
    run(
      el,
      [{ opacity: 0 }, { opacity: 1 }],
      240,
      spread(i, fills.length, 420, 380),
    ),
  )
  // What is marked first comes up whole with the first stroke: a cover's title beside its mark.
  svg
    .querySelectorAll('[data-first]')
    .forEach((el) => run(el, [{ opacity: 0 }, { opacity: 1 }], 480, 0))
  // The live layers redraw themselves, so they come in whole, with the type.
  svg
    .querySelectorAll('[data-live]')
    .forEach((el) => run(el, [{ opacity: 0 }, { opacity: 1 }], 420, 560))
  texts.forEach((el, i) =>
    run(
      el,
      [{ opacity: 0 }, { opacity: 1 }],
      280,
      spread(i, texts.length, 640, 360),
    ),
  )

  return () => anims.forEach((a) => a.cancel())
}
