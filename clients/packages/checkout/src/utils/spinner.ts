const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

const createSVGElement = (
  name: string,
  attributes: Record<string, string>,
): SVGElement => {
  const element = document.createElementNS(SVG_NAMESPACE, name)
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, value)
  }
  return element
}

export const spinnerStyles = `
  .polar-loader-spinner {
    width: 20px;
    height: 20px;
    animation: polar-loader-spinner-animation 1s linear infinite;
  }
  @keyframes polar-loader-spinner-animation {
    100% {transform: rotate(360deg)}
  }
`

export const createSpinner = (): SVGElement => {
  const spinner = createSVGElement('svg', {
    class: 'polar-loader-spinner',
    viewBox: '0 0 24 24',
    fill: 'none',
  })
  spinner.append(
    createSVGElement('circle', {
      cx: '12',
      cy: '12',
      r: '10',
      stroke: 'currentColor',
      'stroke-width': '4',
      opacity: '0.25',
    }),
    createSVGElement('path', {
      fill: 'currentColor',
      opacity: '0.75',
      d: 'M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z',
    }),
  )
  return spinner
}
