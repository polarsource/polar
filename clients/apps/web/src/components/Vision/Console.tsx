import { twMerge } from 'tailwind-merge'

export interface ConsoleProps {
  className?: string
  title?: string
  input?: string
  output?: string
}

export const Console = ({ className, title, input, output }: ConsoleProps) => {
  return (
    <div className={twMerge('relative flex flex-col', className)}>
      <div className="border-polar-600 absolute right-2 top-2 h-full w-full transform border md:right-6 md:top-6"></div>
      <div className="border-polar-200 bg-polar-900 relative h-full w-full border-2">
        <div className="bg-polar-200 flex flex-row justify-between px-2 py-1 text-xs text-black">
          <span className="font-bold">{title ?? 'Terminal'}</span>
          <span className="h-0.5 w-2 self-end bg-black" />
        </div>
        <div className="flex flex-col overflow-auto p-4 font-mono text-sm">
          <pre className="flex flex-col gap-y-2">
            <code>{input}</code>
            <code className="text-polar-500">{output}</code>
          </pre>
        </div>
      </div>
    </div>
  )
}
