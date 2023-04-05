export type LabelSchema = {
  id: string
  name: string
  color: string // Hex code without the #
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

    if (sum < (255 * 3) / 2) {
      // Very dark, use white
      style.color = '#ffffff'
    } else {
      // Very light, use black
      style.color = '#000000'
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
