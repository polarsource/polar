import { ensureProduct } from './org'
import { PRODUCTS } from './products'

export default async function setup(): Promise<void> {
  for (const spec of Object.values(PRODUCTS)) {
    await ensureProduct(spec)
  }
}
