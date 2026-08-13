import { CONFIG } from '@/utils/config'

export async function GET() {
  return new Response(CONFIG.APPLE_DOMAIN_ASSOCIATION, {
    status: 200,
  })
}
