import { PersonalDetailsStep } from '@/components/Onboarding/PersonalDetailsStep'
import { CONFIG } from '@/utils/config'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function Page() {
  if (CONFIG.IS_SANDBOX) {
    redirect('/onboarding/sandbox')
  }

  const geoCountry = (await headers()).get('x-vercel-ip-country') ?? undefined

  return <PersonalDetailsStep geoCountry={geoCountry} />
}
