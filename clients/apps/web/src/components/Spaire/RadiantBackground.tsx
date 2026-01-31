'use client'

import { twMerge } from 'tailwind-merge'

interface RadiantBackgroundProps {
  children: React.ReactNode
  className?: string
  variant?: 'default' | 'subtle' | 'vibrant'
}

export default function RadiantBackground({
  children,
  className,
  variant = 'default',
}: RadiantBackgroundProps) {
  const intensity = {
    default: {
      indigo: 'opacity-30',
      slate: 'opacity-20',
      charcoal: 'opacity-25',
    },
    subtle: {
      indigo: 'opacity-15',
      slate: 'opacity-10',
      charcoal: 'opacity-15',
    },
    vibrant: {
      indigo: 'opacity-40',
      slate: 'opacity-30',
      charcoal: 'opacity-35',
    },
  }

  return (
    <div
      className={twMerge(
        'relative min-h-screen overflow-hidden',
        'bg-[#0a0a0f] dark:bg-[#0a0a0f]',
        className,
      )}
    >
      {/* Mesh Gradient Orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Top-left indigo orb */}
        <div
          className={twMerge(
            'absolute -left-32 -top-32 h-[600px] w-[600px] rounded-full',
            'bg-indigo-600/40 blur-[128px]',
            intensity[variant].indigo,
          )}
        />

        {/* Top-right slate orb */}
        <div
          className={twMerge(
            'absolute -right-48 -top-24 h-[500px] w-[500px] rounded-full',
            'bg-slate-500/30 blur-[100px]',
            intensity[variant].slate,
          )}
        />

        {/* Bottom-left charcoal orb */}
        <div
          className={twMerge(
            'absolute -bottom-48 -left-24 h-[550px] w-[550px] rounded-full',
            'bg-slate-800/50 blur-[120px]',
            intensity[variant].charcoal,
          )}
        />

        {/* Bottom-right deep blue orb */}
        <div
          className={twMerge(
            'absolute -bottom-32 -right-32 h-[450px] w-[450px] rounded-full',
            'bg-blue-900/30 blur-[100px]',
            intensity[variant].indigo,
          )}
        />

        {/* Center subtle emerald accent */}
        <div
          className={twMerge(
            'absolute left-1/2 top-1/3 h-[300px] w-[300px] -translate-x-1/2 rounded-full',
            'bg-emerald-900/20 blur-[80px]',
            'opacity-20',
          )}
        />
      </div>

      {/* Noise texture overlay for depth */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  )
}
