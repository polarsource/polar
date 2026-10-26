import { SpinnerNoMargin } from '@polar-sh/orbit'
import { useEffect, useState } from 'react'

export interface ProgressMessage {
  readonly text: string
  readonly ms: number
}

const AgentProgress = ({
  messages,
}: {
  messages: readonly ProgressMessage[]
}) => {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (index >= messages.length - 1) return
    const timer = setTimeout(() => setIndex(index + 1), messages[index]?.ms)
    return () => clearTimeout(timer)
  }, [index, messages])

  return (
    <span role="status" className="inline-flex items-center gap-2">
      <SpinnerNoMargin className="dark:text-polar-500 h-3.5 w-3.5 text-gray-400" />
      <span className="dark:from-polar-500 dark:via-polar-100 dark:to-polar-500 [animation:shimmer_2s_linear_infinite] bg-linear-to-r from-gray-400 via-gray-800 to-gray-400 bg-size-[200%_100%] bg-clip-text text-transparent">
        {messages[index]?.text}
      </span>
    </span>
  )
}

export default AgentProgress
