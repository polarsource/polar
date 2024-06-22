import '@testing-library/jest-dom'

import { TextDecoder, TextEncoder } from 'util'

jest.mock('shiki', () => ({}))
jest.mock('shiki/bundle/web', () => ({}))

Object.assign(global, { TextDecoder, TextEncoder })
