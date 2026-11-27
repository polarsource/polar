import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { useModal } from '@/components/Modal/useModal'
import { toast } from '@/components/Toast/use-toast'
import { useRevokeBenefitGrant } from '@/hooks/queries/benefits'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import { UnrevokeBenefitGrantButton } from './UnrevokeBenefitGrantButton'

export const BenefitGrantAction = ({
  grant,
}: {
  grant: schemas['BenefitGrant']
}) =>
  grant.manually_revoked_at ? (
    <UnrevokeBenefitGrantButton grantId={grant.id} />
  ) : grant.is_revoked ? null : (
    <RevokeBenefitGrantButton grant={grant} />
  )

const RevokeBenefitGrantButton = ({
  grant,
}: {
  grant: schemas['BenefitGrant']
}) => {
  const { isShown, show, hide } = useModal()
  const revoke = useRevokeBenefitGrant()

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={show}
        loading={revoke.isPending}
      >
        Revoke
      </Button>
      {isShown && (
        <ConfirmModal
          isShown
          hide={hide}
          title={`Revoke ${grant.benefit.description}?`}
          description={`This revokes this grant${grant.member?.email ? ` for ${grant.member.email}` : ''}. Other grants for the same benefit can still provide access.`}
          destructive
          destructiveText="Revoke benefit"
          onConfirm={async () => {
            const result = await revoke.mutateAsync(grant.id).catch(() => null)
            if (!result) return
            if (result.error) {
              toast({
                title: 'Benefit grant not revoked',
                description: extractApiErrorMessage(result.error),
              })
              return
            }
            toast({ title: 'Benefit grant revoked' })
          }}
        />
      )}
    </>
  )
}
