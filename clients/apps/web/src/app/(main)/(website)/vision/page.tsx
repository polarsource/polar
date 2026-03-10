import { Metadata } from 'next'
import { VisionPage } from '../../../../components/Landing/Vision/VisionPage'

export const metadata: Metadata = {
  title: 'Vision — Polar',
  description:
    'Infrastructure that disappears. We believe the layer between great software and sustainable businesses should be invisible.',
}

export default function Page() {
  return <VisionPage />
}
