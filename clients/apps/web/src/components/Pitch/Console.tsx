import { twMerge } from 'tailwind-merge'

export interface ConsoleProps {
  className?: string
  input?: string
  output?: string
}

export const Console = ({ className, input, output }: ConsoleProps) => {
  return (
    <div
      className={twMerge('border-polar-200 flex flex-col border', className)}
    >
      <div className="bg-polar-200 flex flex-row px-3 py-1 text-xs text-black">
        <span>Polar VM</span>
      </div>
      <div className="flex flex-col p-4 font-mono text-sm">
        <pre className="flex flex-col gap-y-2">
          <code>{'$ ' + input}</code>
          <code className="text-polar-500">{output}</code>
        </pre>
      </div>
    </div>
  )
}
