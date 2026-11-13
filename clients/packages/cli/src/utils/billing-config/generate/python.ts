import type {
  Constant,
  Generator,
  Section,
} from '@/utils/billing-config/generate/contract'

const WIDTH = 88

// Names that cannot be class attributes: keywords, the module the file imports, and what every class already has
const RESERVED = new Set(
  'False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield typing mro'.split(
    ' ',
  ),
)

const attribute = ({ name, value }: Constant) => {
  const literal = JSON.stringify(value)
  return `    ${name}: typing.Literal[${literal}] = ${literal}`
}

const union = (type: string, constants: ReadonlyArray<Constant>) => {
  if (constants.length === 0) return `${type} = typing.Never`
  const values = constants.map(({ value }) => JSON.stringify(value))
  const line = `${type} = typing.Literal[${values.join(', ')}]`
  return line.length <= WIDTH
    ? line
    : [
        `${type} = typing.Literal[`,
        ...values.map((value) => `    ${value},`),
        ']',
      ].join('\n')
}

const section = ({ group, type, description, constants }: Section) =>
  [
    `class ${group}:`,
    `    """${description}"""`,
    ...(constants.length === 0 ? [] : ['']),
    ...constants.map(attribute),
    '',
    '',
    union(type, constants),
  ].join('\n')

export const python: Generator = {
  title: 'Python',
  file: 'polar_types.py',
  manifests: ['pyproject.toml', 'requirements.txt', 'setup.py', 'Pipfile'],
  comment: '#',
  // Formatters and linters would otherwise rewrite the file, and `--check` would call it stale
  directives: ['fmt: off', 'ruff: noqa', 'flake8: noqa', 'pylint: skip-file'],
  reserved: RESERVED,
  render: (sections) =>
    ['import typing', ...sections.map(section)].join('\n\n\n'),
}
