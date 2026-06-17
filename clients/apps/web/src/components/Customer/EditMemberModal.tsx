import { useUpdateMember } from '@/hooks/queries/members'
import { setValidationErrors } from '@/utils/api/errors'
import { isValidationError, schemas } from '@polar-sh/client'
import { Button, Input, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useForm } from 'react-hook-form'
import { toast } from '../Toast/use-toast'

type MemberUpdateForm = Pick<schemas['MemberUpdate'], 'name' | 'email'>

export const EditMemberModal = ({
  member,
  customerId,
  onClose,
}: {
  member: schemas['Member']
  customerId: string
  onClose: () => void
}) => {
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
                  <FormControl>
                    <Input {...field} type="email" value={field.value || ''} />
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
          <Button
            type="submit"
            className="self-end"
            loading={updateMember.isPending}
          >
            Save Member
          </Button>
        </Box>
      </Form>
    </Box>
  )
}
