import type {
  Constant,
  Generator,
  Section,
} from '@/services/billing-config/generate/contract'

const WIDTH = 88

const RESERVED = new Set(
  'False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield typing mro'.split(
    ' ',
  ),
)

const attribute = ({ name, value }: Constant) => {
  const literal = JSON.stringify(value)
  return `    ${name}: typing.Literal[${literal}] = ${literal}`
}

const union = ({ type, constants, open }: Section) => {
  if (open) return `${type} = str`
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

const section = (section: Section) =>
  [
    `class ${section.group}:`,
    `    """${section.description}"""`,
    ...(section.constants.length === 0 ? [] : ['']),
    ...section.constants.map(attribute),
    '',
    '',
    union(section),
  ].join('\n')

export const python: Generator = {
  title: 'Python',
  file: 'polar_types.py',
  manifests: ['pyproject.toml', 'requirements.txt', 'setup.py', 'Pipfile'],
  comment: '#',
  directives: ['fmt: off', 'ruff: noqa', 'flake8: noqa', 'pylint: skip-file'],
  reserved: RESERVED,
  render: (sections) =>
    ['import typing', ...sections.map(section)].join('\n\n\n'),
}
