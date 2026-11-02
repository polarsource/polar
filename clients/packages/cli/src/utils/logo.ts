import * as ui from '@/utils/ui'

const LOGOMARK = [
  '       ██',
  '  ██▄  ██   ▄█',
  '   ▀██▄██  ██▀',
  '▄▄▄▄▄████  ██',
  '▀▀▀▀▀████  ██',
  '   ▄██▀██  ██▄',
  '  ▀█▀  ██   ▀█',
  '       ██',
]

const WIDTH = Math.max(...LOGOMARK.map((row) => row.length))

export const banner = (captions: ReadonlyArray<string>) => {
  const start = Math.floor((LOGOMARK.length - captions.length) / 2)
  return LOGOMARK.map((row, index) => {
    const caption = captions[index - start]
    return caption === undefined
      ? `${ui.INDENT}${row}`
      : `${ui.INDENT}${row.padEnd(WIDTH)}${ui.INDENT}${ui.INDENT}${caption}`
  })
}
