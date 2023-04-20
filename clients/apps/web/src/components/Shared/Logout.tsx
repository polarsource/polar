import React from 'react'
import { useAuth } from '../../hooks'

import { ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline'

const Logout = () => {
  const { authenticated, logout } = useAuth()
  if (!authenticated) {
    return <span>...</span>
  }

  const handleLogout = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    logout()
  }

  return (
    <a
      href="#"
      onClick={handleLogout}
      className="text-gray-500 transition-colors duration-100 hover:text-gray-900 "
    >
      <ArrowRightOnRectangleIcon className="h-6 w-6" aria-hidden="true" />
    </a>
  )
}

export default Logout
