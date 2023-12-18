'use client'

import { useRouter } from 'next/navigation'
import { api } from 'polarkit'
import { Button, Input } from 'polarkit/components/ui/atoms'
import { useState } from 'react'

interface MagicLinkLoginFormProps {
  returnTo?: string
}

const MagicLinkLoginForm: React.FC<MagicLinkLoginFormProps> = ({
  returnTo,
}) => {
  const [email, setEmail] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)

    try {
      await api.magicLink.magicLinkRequest({
        magicLinkRequest: { email, return_to: returnTo },
      })
      const searchParams = new URLSearchParams({ email: email })
      router.push(`/login/magic-link/request?${searchParams}`)
    } catch (err) {
      // TODO: error handling
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="relative w-full" onSubmit={onSubmit}>
      <Input
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        id="magic-link-email"
        name="magic-link-email"
        type="email"
        placeholder="Email"
        required
        className="w-full"
      />
      <div className="absolute inset-y-0 right-0 flex items-center pr-2">
        <Button type="submit" size="sm" loading={loading} disabled={loading}>
          Sign in
        </Button>
      </div>
    </form>
  )
}

export default MagicLinkLoginForm
