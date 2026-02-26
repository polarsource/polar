import { Stack } from '@polar-sh/orbit'
import { OrbitPageHeader } from '../../OrbitPageHeader'

export default function BoxPage() {
  return (
    <Stack vertical gap={10}>
      <OrbitPageHeader
        label="Component"
        title="Box"
        description="Box has been removed. Use className with standard Tailwind utilities for layout and styling. For flex layouts, use Stack."
      />
    </Stack>
  )
}
