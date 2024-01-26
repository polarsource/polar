import Prism from 'prismjs'

export type Theme = Record<
  string | 'base' | keyof Prism.Grammar,
  React.CSSProperties
>

export const polarLight: Theme = {
  base: {
    textAlign: 'left',
    whiteSpace: 'pre',
    wordSpacing: 'normal',
    wordBreak: 'normal',
    wordWrap: 'normal',
    color: '#00193a',
    background: '#F3F4F7',
    MozTabSize: '4',
    OTabSize: '4',
    tabSize: '4',
    WebkitHyphens: 'none',
    MozHyphens: 'none',

    hyphens: 'none',
    overflow: 'auto',
    position: 'relative',
    margin: '0.5em 0',
    padding: '2em',
  },
  atrule: {
    color: '#7c4dff',
  },
  'attr-name': {
    color: '#39adb5',
  },
  'attr-value': {
    color: '#f6a434',
  },
  attribute: {
    color: '#ef6464',
  },
  boolean: {
    color: '#7c4dff',
  },
  builtin: {
    color: '#00f',
    fontStyle: 'italic',
  },
  cdata: {
    color: '#39adb5',
  },
  char: {
    color: '#39adb5',
  },
  class: {
    color: '#ef6464',
  },
  'class-name': {
    color: '#ef6464',
  },
  comment: {
    color: '#008000',
    fontStyle: 'italic',
  },
  constant: {
    color: '#7c4dff',
  },
  deleted: {
    color: '#e53935',
  },
  doctype: {
    color: '#aabfc9',
  },
  entity: {
    color: '#e53935',
  },
  function: {
    color: '#7c4dff',
  },
  hexcode: {
    color: '#f76d47',
  },
  id: {
    color: '#7c4dff',
    fontWeight: 'bold',
  },
  important: {
    color: '#7c4dff',
    fontWeight: 'bold',
  },
  inserted: {
    color: '#39adb5',
  },
  keyword: {
    color: '#00f',
    fontStyle: 'italic',
  },
  number: {
    color: '#f76d47',
  },
  operator: {
    color: '#39adb5',
  },
  prolog: {
    color: '#aabfc9',
  },
  property: {
    color: '#39adb5',
  },
  'pseudo-class': {
    color: '#f6a434',
  },
  'pseudo-element': {
    color: '#f6a434',
  },
  punctuation: {
    color: '#39adb5',
  },
  regex: {
    color: '#6182b8',
  },
  selector: {
    color: '#00f',
  },
  string: {
    color: '#ef6464',
  },
  symbol: {
    color: '#7c4dff',
  },
  tag: {
    color: '#00f',
  },
  unit: {
    color: '#f76d47',
  },
  url: {
    color: '#e53935',
  },
  variable: {
    color: '#008000',
  },
} as const

export const polarDark: Theme = {
  base: {
    textAlign: 'left',
    whiteSpace: 'pre',
    wordSpacing: 'normal',
    wordBreak: 'normal',
    wordWrap: 'normal',
    color: '#E5EFFF',
    background: '#16171F',
    MozTabSize: '4',
    OTabSize: '4',
    tabSize: '4',
    WebkitHyphens: 'none',
    MozHyphens: 'none',

    hyphens: 'none',
    overflow: 'auto',
    position: 'relative',
    margin: '0.5em 0',
    padding: '2em',
  },
  atrule: {
    color: '#c792ea',
  },
  'attr-name': {
    color: '#ffcb6b',
  },
  'attr-value': {
    color: '#a5e844',
  },
  attribute: {
    color: '#80cbc4',
  },
  boolean: {
    color: '#c792ea',
  },
  builtin: {
    color: '#99C0FF',
    fontStyle: 'italic',
  },
  cdata: {
    color: '#80cbc4',
  },
  char: {
    color: '#80cbc4',
  },
  class: {
    color: '#ffcb8b',
  },
  'class-name': {
    color: '#80ed99',
  },
  comment: {
    color: '#4C5069',
    fontStyle: 'italic',
  },
  constant: {
    color: '#c792ea',
  },
  deleted: {
    color: '#ff6666',
  },
  doctype: {
    color: '#616161',
  },
  entity: {
    color: '#ff6666',
  },
  function: {
    color: '#80ed99',
  },
  hexcode: {
    color: '#f2ff00',
  },
  id: {
    color: '#c792ea',
    fontWeight: 'bold',
  },
  important: {
    color: '#c792ea',
    fontWeight: 'bold',
  },
  inserted: {
    color: '#80cbc4',
  },
  keyword: {
    color: '#3381FF',
    fontStyle: 'italic',
  },
  number: {
    color: '#3381FF',
  },
  operator: {
    color: '#89ddff',
  },
  prolog: {
    color: '#616161',
  },
  property: {
    color: '#80cbc4',
  },
  'pseudo-class': {
    color: '#a5e844',
  },
  'pseudo-element': {
    color: '#a5e844',
  },
  punctuation: {
    color: '#89ddff',
  },
  regex: {
    color: '#5ca7e4',
  },
  selector: {
    color: '#ff6666',
  },
  string: {
    color: '#ecc48d',
  },
  symbol: {
    color: '#80ed99',
  },
  tag: {
    color: '#13C4A3',
  },
  unit: {
    color: '#fd9170',
  },
  url: {
    color: '#ff869a',
  },
  variable: {
    color: '#99C0FF',
  },
} as const
