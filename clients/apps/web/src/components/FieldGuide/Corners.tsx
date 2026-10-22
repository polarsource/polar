const AT = [
  'top-[-1px] left-[-1px] border-t border-l',
  'top-[-1px] right-[-1px] border-t border-r',
  'right-[-1px] bottom-[-1px] border-r border-b',
  'bottom-[-1px] left-[-1px] border-b border-l',
]

/**
 * The figure frame's corner marks, set on a bordered box's border: one per corner, each two short Mid strokes, lit
 * in the accent while the nearest `group` is hovered. The box must be positioned.
 */
export function Corners() {
  return AT.map((at) => (
    <span
      key={at}
      aria-hidden
      className={`pointer-events-none absolute size-3 border-[#8f8f8f] transition-colors duration-75 group-hover:border-indigo-500 ${at}`}
    />
  ))
}
