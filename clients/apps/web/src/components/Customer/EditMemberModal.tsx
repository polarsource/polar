import { useUpdateMember } from '@/hooks/queries/members'
import { setValidationErrors } from '@/utils/api/errors'
import { isValidationError, schemas } from '@polar-sh/client'
import { Button, Input, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useForm } from 'react-hook-form'
import { MemberSeats } from './MemberSeats'
import { toast } from '../Toast/use-toast'

type MemberUpdateForm = Pick<schemas['MemberUpdate'], 'name' | 'email'>

export const EditMemberModal = ({
  member,
  customerId,
  seats,
  organizationSlug,
  customerType,
  onClose,
}: {
  member: schemas['Member']
  customerId: string
  seats: schemas['CustomerSeat'][]
  organizationSlug: string
  customerType?: 'individual' | 'team'
  onClose: () => void
}) => {
  // Defensive block for individual customer type
  const isEmailLocked = member.role === 'owner' && customerType === 'individual'

  const form = useForm<MemberUpdateForm>({
    defaultValues: {
      name: member.name ?? '',
      email: member.email,
    },
  })

  const updateMember = useUpdateMember(member.id, customerId)

  const handleUpdateMember = (memberUpdate: MemberUpdateForm) => {
    updateMember
      .mutateAsync(memberUpdate)
      .then(({ error }) => {
        if (error) {
          if (error.detail) {
            if (isValidationError(error.detail)) {
              setValidationErrors(error.detail, form.setError)
            } else {
              toast({
                title: 'Member Update Failed',
                description: `Error updating member ${member.email}: ${error.detail}`,
              })
            }
          }
          return
        }

        toast({
          title: 'Member Updated',
          description: `Member ${member.email} updated successfully`,
        })
        onClose()
      })
      .catch(() => {
        toast({
          title: 'Member Update Failed',
          description: `Error updating member ${member.email}. Please try again.`,
        })
      })
  }

  return (
    <Box
      flexDirection="column"
      gap="2xl"
      overflowY="auto"
      paddingHorizontal="2xl"
      paddingVertical="3xl"
    >
      <Box alignItems="center" columnGap="l">
        <Text as="h2" variant="heading-xs">
          Edit Member
        </Text>
      </Box>
      <Form {...form}>
        <Box
          as="form"
          onSubmit={form.handleSubmit(handleUpdateMember)}
          flexDirection="column"
          gap="2xl"
        >
          <Box flexDirection="column" gap="l">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  {isEmailLocked && (
                    <FormDescription>
                      The owner&apos;s email follows the customer&apos;s email
                      and can&apos;t be changed here.
                    </FormDescription>
                  )}
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      value={field.value || ''}
                      disabled={isEmailLocked}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Box>
          <Box flexDirection="column" gap="m">
            <Text variant="body" as="h3">
              Assigned Seats
            </Text>
            <MemberSeats seats={seats} organizationSlug={organizationSlug} />
          </Box>
          <Box justifyContent="end">
            <Button type="submit" loading={updateMember.isPending}>
              Update Member
            </Button>
          </Box>
        </Box>
      </Form>
    </Box>
  )
}
