import type { Names } from '@/utils/billing-config/generate/names'

const WIDTH = 88

// Names that cannot be class attributes: keywords, the module the file imports, and what every class already has
const RESERVED = new Set(
  'False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield typing mro'.split(
    ' ',
  ),
)

const SPELLED: Record<string, string> = {
  '-': '_dash_',
  '.': '_dot_',
  ':': '_colon_',
}

const isName = (name: string) =>
  /^[A-Za-z][A-Za-z0-9_]*$/.test(name) && !RESERVED.has(name)

const toName = (id: string, spellPunctuation: boolean) => {
  const spelled = spellPunctuation
    ? id.replaceAll(/[-.:]/g, (character) => SPELLED[character]!)
    : id
  const base = spelled.replaceAll(/\W/g, '_').replace(/^_+/, '')
  return isName(base) ? base : `id_${base}`
}

// A name that is already valid always keeps itself. The others never depend on their position in the config, so reordering it cannot make a constant mean something else.
const attributesOf = (ids: ReadonlyArray<string>) => {
  const plain = ids.map((id) => toName(id, false))
  const taken = new Set(ids.filter(isName))
  const attributes = new Map<string, string>()
  for (const id of ids.filter((id) => !isName(id)).toSorted()) {
    const simple = toName(id, false)
    const shared = plain.filter((other) => other === simple).length > 1
    const wanted = shared ? toName(id, true) : simple
    let attribute = wanted
    for (let count = 2; taken.has(attribute); count++) {
      attribute = `${wanted}_${count}`
    }
    taken.add(attribute)
    attributes.set(id, attribute)
  }
  return ids.map((id) => attributes.get(id) ?? id)
}

const literal = (type: string, ids: ReadonlyArray<string>) => {
  if (ids.length === 0) return `${type} = typing.Never`
  const values = ids.map((id) => JSON.stringify(id))
  const line = `${type} = typing.Literal[${values.join(', ')}]`
  return line.length <= WIDTH
    ? line
    : [
        `${type} = typing.Literal[`,
        ...values.map((value) => `    ${value},`),
        ']',
      ].join('\n')
}

const section = (
  className: string,
  type: string,
  ids: ReadonlyArray<string>,
) => {
  const attributes = attributesOf(ids)
  return [
    `class ${className}:`,
    ...(ids.length === 0
      ? ['    pass']
      : ids.map(
          (id, index) =>
            `    ${attributes[index]}: typing.Final = ${JSON.stringify(id)}`,
        )),
    '',
    '',
    literal(type, ids),
  ].join('\n')
}

const render = ({ events, meters, benefits, products }: Names) =>
  [
    'import typing',
    section('Events', 'EventName', events),
    section('Meters', 'MeterId', meters),
    section('Benefits', 'BenefitId', benefits),
    section('Products', 'ProductId', products),
  ].join('\n\n\n')

export const python = {
  title: 'Python',
  aliases: ['python'],
  file: 'polar_types.py',
  extension: '.py',
  manifest: 'pyproject.toml',
  comment: '#',
  // Formatters and linters would otherwise rewrite the file, and `--check` would call it stale
  directives: ['fmt: off', 'ruff: noqa'],
  render,
} as const
