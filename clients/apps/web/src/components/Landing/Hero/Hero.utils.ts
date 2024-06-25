export const quadraticCurve = (
  start: { x: number; y: number },
  end: { x: number; y: number },
  vertical?: boolean,
) => {
  const x1 = start.x
  const y1 = start.y
  const x4 = end.x
  const y4 = end.y
  const min_diff = 30
  let offset: number

  if (Math.abs(y4 - y1) < min_diff * 2) {
    offset = Math.abs(y4 - y1) / 2
  } else {
    offset = min_diff
  }

  let offsetX = offset
  let offsetY = offset

  offsetY = Math.min(Math.max((y4 - y1) / 2, -offset), offset)
  offsetX = Math.min(Math.max((x4 - x1) / 2, -offset), offset)

  if (vertical) {
    return `
      M${x1},${y1} 
      L${x1},${y4 - offsetY} 
      Q${x1},${y4} ${x1 + offsetX},${y4}
      L${x4},${y4}
  `
  } else {
    return `
        M${x1},${y1} 
        L${x4 - offsetX},${y1} 
        Q${x4},${y1} ${x4},${y1 + offsetY}
        L${x4},${y4}
    `
  }
}
