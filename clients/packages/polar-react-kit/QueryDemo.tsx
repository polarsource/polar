import * as React from 'react'

import { useDemos } from './hooks'

export const QueryDemo = () => {
  const demo = useDemos()

  if (demo.isLoading) return <div>Loading...</div>

  if (demo.isError) return <div>Error: {demo.error.message}</div>

  console.log(demo.data)
  return (
    <>
      <h2>Demo data</h2>
      <ul>
        {demo.data.map((item) => (
          <li key={item.id}>{item.testing}</li>
        ))}
      </ul>
    </>
  )
  return <button>Boop</button>
}
