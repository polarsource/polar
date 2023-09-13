import { useRouter } from 'next/navigation'
import { api } from 'polarkit'
import { PrimaryButton } from 'polarkit/components/ui'
import { useState } from 'react'

interface MagicLinkLoginFormProps {}

const MagicLinkLoginForm: React.FC<MagicLinkLoginFormProps> = ({}) => {
  const [email, setEmail] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)

    try {
      await api.magicLink.requestMagicLink({ requestBody: { email } })
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
      <input
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        id="magic-link-email"
        name="magic-link-email"
        type="email"
        placeholder="Email"
        required
        className="text-md block w-full rounded-xl border-0 p-2.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:placeholder-gray-500 dark:ring-gray-700 dark:focus:ring-blue-500 dark:focus:ring-offset-gray-800"
      />
      <div className="absolute inset-y-0 right-0 flex items-center pr-2.5">
        <PrimaryButton
          type="submit"
          size="small"
          loading={loading}
          disabled={loading}
        >
          Sign in
        </PrimaryButton>
      </div>
    </form>
  )
}

export default MagicLinkLoginForm
