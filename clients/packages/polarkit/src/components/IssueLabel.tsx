type LabelSchema = {
  name: string
  color: string // Hex code without the #
}

const componentToHex = (c: number): string => {
  const hex = c.toString(16)
  return hex.length == 1 ? '0' + hex : hex
}

const rgbToHex = (r: number, g: number, b: number): string => {
  return '#' + componentToHex(r) + componentToHex(g) + componentToHex(b)
}

const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null
}
const clamp = (a: number, min: number, max: number): number => {
  return a < min ? min : a > max ? max : a
}

const IssueLabel = (props: { label: LabelSchema }) => {
  const { name, color } = props.label
  const style = {
    backgroundColor: `#${color}`,
    color: '#000000',
  }

  let sum = 0

  // Generate text color based on background color
  const rgb = hexToRgb(color)
  if (rgb) {
    const { r, g, b } = rgb
    sum = r + g + b

    if (sum < 100) {
      // Very dark, use white
      style.color = '#ffffff'
    } else if (sum > 255 * 3 - 100) {
      // Very light, use black
      style.color = '#000000'
    } else {
      let scale = 2.4 // Lighten
      if (sum > 400) {
        scale = 0.4 // Darken
      }

      const newColor = rgbToHex(
        parseInt(clamp(r * scale, 0, 255).toFixed(0)),
        parseInt(clamp(g * scale, 0, 255).toFixed(0)),
        parseInt(clamp(b * scale, 0, 255).toFixed(0)),
      )
      style.color = newColor
    }
  }

  return (
    <>
      <div
        className="whitespace-nowrap rounded-xl px-2 py-0.5 text-sm"
        style={style}
      >
        {name}
      </div>
    </>
  )
}

export default IssueLabel
