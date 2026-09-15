import { styleText } from 'node:util'

type Style = Parameters<typeof styleText>[0]

export const styleEnabled = () =>
  process.stdout?.isTTY === true && process.env.NO_COLOR === undefined

const paint = (style: Style, text: string, on = false) =>
  on && text ? styleText(style, text, { validateStream: false }) : text

export const heavy = (text: string, on = false) => paint('bold', text, on)

export const soft = (text: string, on = false) => paint('dim', text, on)

export const aside = (text: string, on = false) =>
  paint(['dim', 'italic'], text, on)

export const rule = (width: number, on = false) =>
  soft('─'.repeat(Math.max(0, width)), on)
