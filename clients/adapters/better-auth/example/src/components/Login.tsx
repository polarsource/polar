'use client'

import { signIn } from '@/lib/auth-client'
import { useState } from 'react'

export const Login = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  return (
    <div className="flex flex-col gap-4">
      <h1>Login</h1>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button
        type="button"
        className="rounded-md bg-blue-500 p-2 text-white"
        onClick={async () => {
          const user = await signIn.email({
            email,
            password,
          })

          console.log(user)
        }}
      >
        Sign In
      </button>
    </div>
  )
}
