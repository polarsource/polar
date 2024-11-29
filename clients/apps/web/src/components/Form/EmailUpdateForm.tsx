'use client'

import { FormControl } from '@mui/material'
import Button from 'polarkit/components/ui/atoms/button'
import Input from 'polarkit/components/ui/atoms/input'

import {
  Form,
  FormField,
  FormItem
} from 'polarkit/components/ui/form'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

interface EmailUpdateformProps {
  returnTo?: string
}

const EmailUpdateForm: React.FC<EmailUpdateformProps> = ({
  returnTo
}) => {

  const form = useForm<{ email: string }>()
  const { control, handleSubmit, setError } = form
  const [loading, setLoading] = useState(false)

  return (
    <Form {...form}>
      <form className="flex w-full flex-col">
        <FormField
          control={control}
          name="email"
          render={({ field }) => {
            return (
              <FormItem>
                <FormControl className="w-full">
                  <div className="flex w-full flex-row gap-2">
                    <Input
                      type="email"
                      required
                      placeholder="New email"
                      autoComplete="off"
                      data-1p-ignore
                      {...field}
                    />
                    <Button type="submit" size="lg" variant="secondary" loading={loading} disabled={loading}>
                      Update
                    </Button>
                  </div>
                </FormControl>
              </FormItem>
            )
          }}
        />
      </form>
    </Form>
  )
}

export default EmailUpdateForm