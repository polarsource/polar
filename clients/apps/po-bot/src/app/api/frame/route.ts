import { snapshot } from '@/live'

export const dynamic = 'force-dynamic'

/** Every channel as the broadcaster last saw it, for a tab's first paint. */
export const GET = () => Response.json(snapshot())
