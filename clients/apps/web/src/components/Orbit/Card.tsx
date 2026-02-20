import { twMerge } from 'tailwind-merge'
import { Button, type ButtonProps } from './Button'

export function Card({
  children,
  className,
  padding = 'p-6',
  gap = 'gap-4',
}: {
  children?: React.ReactNode
  className?: string
  padding?: string
  gap?: string
}) {
  return (
    <div
      className={twMerge(
        'flex flex-col rounded-2xl bg-neutral-50 dark:bg-polar-900',
        padding,
        gap,
        className,
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  children,
  className,
}: {
  children?: React.ReactNode
  className?: string
}) {
  return <div className={twMerge(className)}>{children}</div>
}

export function CardContent({
  children,
  className,
}: {
  children?: React.ReactNode
  className?: string
}) {
  return <div className={twMerge('flex-1', className)}>{children}</div>
}

export function CardFooter({
  children,
  className,
  actions,
}: {
  children?: React.ReactNode
  className?: string
  actions?: ButtonProps[]
}) {
  return (
    <div className={twMerge(actions ? 'pt-4' : undefined, className)}>
      {children}
      {actions && (
        <div className="flex gap-3">
          {actions.map((props, i) => (
            <Button key={i} {...props} />
          ))}
        </div>
      )}
    </div>
  )
}
