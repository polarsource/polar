'use client'

export const isImpersonating = () => {
  const cookies = document.cookie.split(';')
  const impersonationCookie = cookies.filter((cookie) =>
    cookie.trim().startsWith('polar_is_impersonating='),
  )
  if (impersonationCookie.length == 0) {
    return false
  }
  const [_, value] = impersonationCookie[0].split('=')

  return value === 'true'
}
