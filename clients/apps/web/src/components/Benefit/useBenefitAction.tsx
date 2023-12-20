import { ArrowForwardOutlined } from '@mui/icons-material'
import { SvgIconTypeMap } from '@mui/material'
import { OverridableComponent } from '@mui/material/OverridableComponent'
import { useRouter } from 'next/navigation'
import { useOrganization } from 'polarkit/hooks'
import { Benefit } from './Benefit'

interface BenefitAction {
  icon: OverridableComponent<SvgIconTypeMap<{}, 'svg'>> & {
    muiName: string
  }
  onClick: () => void
  key: string
}

export const useBenefitActions = (benefit: Benefit): BenefitAction[] => {
  const router = useRouter()
  const { data: organization } = useOrganization(benefit.organization_id ?? '')

  switch (benefit.type) {
    case 'articles':
      return [
        {
          key: 'article',
          icon: ArrowForwardOutlined,
          onClick: () => {
            router.push(`/${organization?.name}`)
          },
        },
      ]
    default:
      return []
  }
}
