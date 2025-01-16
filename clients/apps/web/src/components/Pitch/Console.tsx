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
      <div className="border-polar-600 absolute right-6 top-6 h-full w-full transform border"></div>
      <div className="border-polar-200 bg-polar-900 relative h-full w-full border-2">
        <div className="bg-polar-200 flex flex-row justify-between px-3 py-1 text-xs text-black">
          <span className="font-bold">{title ?? 'Polar VM'}</span>
        </div>
        <div className="flex flex-col p-4 font-mono text-sm">
          <pre className="flex flex-col gap-y-2">
            <code>{input}</code>
            <code className="text-polar-500">{output}</code>
          </pre>
        </div>
      </div>
    </div>
  )
}
