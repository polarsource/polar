import { ApiReference, ApiReferenceOptions } from '@scalar/nextjs-api-reference'

const config: ApiReferenceOptions = {
  spec: {
    url: 'https://spec.speakeasy.com/polar/polar/polar-oas-with-code-samples',
  },
}

export const GET = ApiReference(config)
