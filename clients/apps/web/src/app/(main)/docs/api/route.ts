// app/reference/route.js
import { ApiReference, ApiReferenceOptions } from '@scalar/nextjs-api-reference'

const config: ApiReferenceOptions = {
  spec: {
    url: 'https://spec.speakeasy.com/polar/polar/polar-oas-with-code-samples',
  },
  tagsSorter: 'alpha',
}

export const GET = ApiReference(config)
