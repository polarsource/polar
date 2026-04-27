import { SandboxStep } from '@/components/Onboarding/SandboxStep'
import { CONFIG } from '@/utils/config'
import { redirect } from 'next/navigation'

export default function Page() {
  if (!CONFIG.IS_SANDBOX) {
    redirect('/onboarding/start')
  }

  return <SandboxStep />
}
