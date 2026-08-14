'use client'

import { useAssignOrganizationSeat } from '@/hooks/queries/seats'
import { validateEmail } from '@/utils/validation'
import { schemas } from '@polar-sh/client'
import { Button, InlineModalHeader, Input, Text } from '@polar-sh/orbit'
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

interface AssignSeatModalProps {
  subscription: schemas['Subscription']
  hide: () => void
}

export const AssignSeatModal = ({
  subscription,
  hide,
}: AssignSeatModalProps) => {
  const assignSeat = useAssignOrganizationSeat()

  const form = useForm<{ email: string }>({
    defaultValues: {
      email: '',
    },
  })
  const { control, handleSubmit, setError } = form

  const onSubmit = async ({ email }: { email: string }) => {
    try {
      const { data, error } = await assignSeat.mutateAsync({
        subscription_id: subscription.id,
        email,
      })
      if (error) {
        setError('email', {
          message:
            typeof error.detail === 'string'
              ? error.detail
              : 'Failed to assign seat',
        })
        return
      }
      if (data) {
        toast({
          title: 'Invitation sent',
          description: `An invitation email has been sent to ${data.customer_email ?? email}`,
        })
      }
      hide()
    } catch {
      setError('email', { message: 'Failed to assign seat' })
    }
  }

  return (
    <Box flexDirection="column" overflowY="auto">
      <InlineModalHeader hide={hide}>
        <Text variant="heading-xxs" as="h2">
          Assign Seat
        </Text>
      </InlineModalHeader>
      <Box
        flexDirection="column"
        rowGap="2xl"
        paddingHorizontal="2xl"
        paddingBottom="3xl"
      >
        <Text color="muted">
          The recipient will receive an invitation email with a link to claim
          the seat.
        </Text>
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Box flexDirection="column" rowGap="xl">
              <FormField
                control={control}
                name="email"
                rules={{
                  required: 'Email is required',
                  validate: (value) =>
                    validateEmail(value) || 'Enter a valid email address',
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="customer@example.com"
                        autoComplete="off"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Box
                flexDirection={{ base: 'column', md: 'row-reverse' }}
                gap="l"
                alignItems={{ md: 'center' }}
              >
                <Button type="submit" loading={assignSeat.isPending}>
                  Assign Seat
                </Button>
                <Button variant="ghost" onClick={hide}>
                  Cancel
                </Button>
              </Box>
            </Box>
          </form>
        </Form>
      </Box>
    </Box>
  )
}
