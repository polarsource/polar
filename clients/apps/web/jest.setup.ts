import '@testing-library/jest-dom'

import { TextDecoder, TextEncoder } from 'util'

jest.mock('shiki', () => ({}))
jest.mock('shiki/bundle/full', () => ({}))

Object.assign(global, { TextDecoder, TextEncoder })
