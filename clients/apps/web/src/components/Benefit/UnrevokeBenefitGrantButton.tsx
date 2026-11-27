import { toast } from '@/components/Toast/use-toast'
import { useUnrevokeBenefitGrant } from '@/hooks/queries/benefits'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { Button } from '@polar-sh/orbit'

export const UnrevokeBenefitGrantButton = ({
  grantId,
}: {
  grantId: string
}) => {
  const unrevoke = useUnrevokeBenefitGrant()

  const onClick = async () => {
    const result = await unrevoke.mutateAsync(grantId).catch(() => null)
    if (!result) return

    if (result.error) {
      toast({
        title: 'Could not unrevoke benefit grant',
        description: extractApiErrorMessage(result.error),
      })
      return
    }
    toast({ title: 'Manual revocation cleared' })
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      loading={unrevoke.isPending}
      onClick={onClick}
    >
      Unrevoke
    </Button>
  )
}
