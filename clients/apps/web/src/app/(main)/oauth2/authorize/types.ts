import { operations } from '@spaire/client'

export type AuthorizeResponse =
  operations['oauth2:authorize']['responses']['200']['content']['application/json']
