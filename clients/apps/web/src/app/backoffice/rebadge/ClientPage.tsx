'use client'

import { api } from 'polarkit/api'
import { Input } from 'polarkit/components/ui/atoms'
import { Button } from 'polarkit/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from 'polarkit/components/ui/form'
import { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'

interface Form {
  org_slug: string
  repo_slug: string
}

const ClientPage = () => {
  const form = useForm<Form>({
    defaultValues: {},
  })

  const { handleSubmit } = form

  const [showDidSave, setShowDidSave] = useState(false)

  const [res, setRes] = useState<any>()

  const onSubmit = useCallback(async (form: Form) => {
    const res = await api.backoffice.updateBadgeContents({
      repoSlug: form.repo_slug,
      orgSlug: form.org_slug,
    })

    setRes(res)

    setShowDidSave(true)

    setTimeout(() => {
      setShowDidSave(false)
    }, 4000)
  }, [])
  return (
    <div className="dark:text-polar:300 space-y-2 p-4 text-sm text-gray-500">
      <Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-2">
          <FormField
            control={form.control}
            name="org_slug"
            rules={{
              required: 'This field is required',
            }}
            defaultValue="someorg"
            render={({ field }) => (
              <FormItem className="max-w-[300px]">
                <div className="flex flex-row items-center justify-between">
                  <FormLabel>Organization name</FormLabel>
                </div>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="repo_slug"
            rules={{
              required: 'This field is required',
            }}
            defaultValue="somerepo"
            render={({ field }) => (
              <FormItem className="max-w-[300px]">
                <div className="flex flex-row items-center justify-between">
                  <FormLabel>Repository name</FormLabel>
                </div>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex items-center gap-2">
            <Button type="submit" variant="default">
              Do it
            </Button>

            {showDidSave && <div>Scheduled!</div>}
          </div>
        </form>
      </Form>

      <hr />
      <pre>{JSON.stringify(res, null, 4)}</pre>
    </div>
  )
}

export default ClientPage
