import { LockOutlined } from '@polar-sh/orbit/icons'
import { Pill } from '@polar-sh/orbit'

export const ManagedAsCodeBadge = () => (
  <Pill color="gray">
    <LockOutlined fontSize="inherit" />
    <span>Managed in code</span>
  </Pill>
)
