import type { Messages } from '@polar-sh/i18n'

declare module 'next-intl' {
  interface IntlMessages extends Messages {}
}
