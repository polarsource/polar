'use client'

import { useEffect, useState } from 'react'
import TimeAgo from 'react-timeago'

const PolarTimeAgo = (props: { date: Date; suffix?: string }) => {
  const [rendered, setRendered] = useState(false)

  useEffect(() => {
    setRendered(true)
  }, [])

  // hide during hydration
  if (!rendered) {
    return <></>
  }

  return (
    <TimeAgo
      date={props.date}
      formatter={(value, unit, suffix) => {
        if (unit === 'second') {
          return 'just now'
        }
        return `${value} ${unit}${value !== 1 ? 's' : ''} ${
          props.suffix ?? suffix
        }`
      }}
    />
  )
}

export default PolarTimeAgo
