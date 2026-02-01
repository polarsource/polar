'use client'

import { Lock } from 'lucide-react'
import { twMerge } from 'tailwind-merge'

interface SpaireCardProps {
  className?: string
}

const LockedVirtualCard = () => {
  return (
    <div
      className={twMerge(
        'relative overflow-hidden rounded-3xl bg-gradient-to-br from-black via-gray-950 to-black p-5',
        'grayscale',
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent" />

      <div className="relative z-10 flex flex-col gap-5">
        <div className="flex items-start justify-between">
          <span className="text-sm tracking-wide text-white/60">SPAIRE</span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-white/40">virtual</span>
            <div className="h-1.5 w-1.5 rounded-full bg-gray-600" />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-white/30">
            <Lock className="h-3 w-3" />
            <span className="text-xs">Locked</span>
          </div>
          <p className="font-mono text-lg tracking-widest text-white/40">
            •••• •••• •••• ••••
          </p>
        </div>

        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-white/30">Cardholder</p>
            <p className="text-sm text-white/50">YOUR NAME</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/30">Expires</p>
            <p className="font-mono text-sm text-white/50">••/••</p>
          </div>
        </div>

        <div className="flex justify-end">
          <span className="text-lg italic text-white/40">Visa</span>
        </div>
      </div>
    </div>
  )
}

export default function SpaireCard({ className }: SpaireCardProps) {
  return (
    <div
      className={twMerge(
        'dark:bg-polar-800 flex flex-col rounded-4xl bg-gray-50',
        className,
      )}
    >
      <div className="flex flex-col gap-y-4 p-4">
        <div className="flex flex-row items-center justify-between px-2 pt-2">
          <span className="text-lg">Business Card</span>
          <span className="dark:bg-polar-700 dark:text-polar-400 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
            Early Access
          </span>
        </div>

        <LockedVirtualCard />
      </div>

      <div className="dark:bg-polar-700 m-2 flex flex-col gap-y-4 rounded-3xl bg-white p-4">
        <p className="dark:text-polar-300 text-sm text-gray-600">
          Business cards are currently in early access.{' '}
          <a
            href="https://spairehq.com/business-card-waitlist"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-blue-600 underline underline-offset-2 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Join the Waitlist
          </a>{' '}
          to be notified as we roll this out to founders in your region.
        </p>
      </div>
    </div>
  )
}
