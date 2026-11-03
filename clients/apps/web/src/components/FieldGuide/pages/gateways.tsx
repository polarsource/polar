import { MONO } from '../sheet'
import { Anchor, BG, Callout, DIM, HAIR, LINE } from '../kit'
import { landscape } from './more'

/**
 * Events without code: model calls already pass through an AI gateway on their way to the model, and the gateway
 * hands each one to Polar as an `llm.completion` event.
 */

const BW = 104,
  BH = 40
const ROW = 150
const DOWN = 262
const APP_X = 40,
  GATE_X = 196,
  MODELS_X = 352
const MID_Y = ROW + BH / 2
const GATE_C = GATE_X + BW / 2

const text = (x: number, y: number, t: string, fill = DIM) => (
  <text
    x={x}
    y={y}
    fontSize={7.5}
    fill={fill}
    textAnchor="middle"
    style={{ ...MONO, letterSpacing: 0 }}
  >
    {t}
  </text>
)

const box = (x: number, y: number, name: string, sub: string) => (
  <g>
    <rect
      x={x}
      y={y}
      width={BW}
      height={BH}
      fill={BG}
      stroke={LINE}
      strokeWidth={HAIR}
    />
    {text(x + BW / 2, y + 16, name)}
    {text(x + BW / 2, y + 29, sub, LINE)}
  </g>
)

const arrow = (x1: number, y1: number, x2: number, y2: number) => {
  const horizontal = y1 === y2
  const head = horizontal
    ? `M${x2 - 7} ${y2 - 3}L${x2} ${y2}L${x2 - 7} ${y2 + 3}Z`
    : `M${x2 - 3} ${y2 - 7}L${x2} ${y2}L${x2 + 3} ${y2 - 7}Z`
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={LINE} strokeWidth={HAIR} />
      <path d={head} fill={LINE} />
    </g>
  )
}

const figure = (
  <>
    {box(APP_X, ROW, 'YOUR APP', 'generate()')}
    {box(GATE_X, ROW, 'AI GATEWAY', 'routes the call')}
    {box(MODELS_X, ROW, 'MODELS', 'claude · gpt · gemini')}
    {arrow(APP_X + BW, MID_Y, GATE_X, MID_Y)}
    {arrow(GATE_X + BW, MID_Y, MODELS_X, MID_Y)}

    {arrow(GATE_C, ROW + BH, GATE_C, DOWN)}
    <Anchor at={[GATE_C, ROW + BH]} />
    {box(GATE_X, DOWN, 'POLAR', 'event log')}
    <Callout
      at={[GATE_C, (ROW + BH + DOWN) / 2]}
      to={[GATE_C + 40, (ROW + BH + DOWN) / 2]}
    >
      llm.completion
    </Callout>
    <text
      x={GATE_C + 48}
      y={(ROW + BH + DOWN) / 2 + 16}
      fontSize={7.5}
      fill={DIM}
      style={{ ...MONO, letterSpacing: 0 }}
    >
      {'{ model, input_tokens, output_tokens, cost }'}
    </text>
  </>
)

export const gateways = landscape(
  'm-gateways',
  'AI gateways',
  'Model calls through an AI gateway are metered with no extra code.',
  'Your app calls a model through an AI gateway. The gateway passes the call on to the model and sends Polar one llm.completion event for it, with the model, the input and output tokens, and the cost.',
  figure,
  [
    [
      'Through your gateway',
      [
        'If your model calls already go through an AI gateway, Polar connects to it and records every call as an event.',
      ],
    ],
    [
      'One event per call',
      [
        'Each call becomes one llm.completion event, with the model and its input and output tokens. There is nothing to add to your code.',
      ],
    ],
    [
      'Cost included',
      [
        'The gateway knows what each call cost, so the event carries it, and Polar knows your margin on every customer as the usage happens.',
      ],
    ],
  ],
)
