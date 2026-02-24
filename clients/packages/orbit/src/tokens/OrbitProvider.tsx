'use client'

import React, { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import { tokens } from './vars'

// ── Types ──────────────────────────────────────────────────────────────────────

export type OrbitTokens = typeof tokens

// ── Context ───────────────────────────────────────────────────────────────────

const OrbitContext = createContext<OrbitTokens>(tokens)

// ── Provider ──────────────────────────────────────────────────────────────────

export interface OrbitProviderProps {
  children: ReactNode
}

/**
 * Provides Orbit design tokens to the component tree.
 * Theming is handled by CSS custom properties — apply `.dark` on the root
 * element (or use next-themes) and the CSS variables update automatically.
 */
export function OrbitProvider({ children }: OrbitProviderProps) {
  return <OrbitContext.Provider value={tokens}>{children}</OrbitContext.Provider>
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Returns Orbit design tokens as CSS variable references (`var(--token-name)`).
 * Use the returned strings directly as Tailwind arbitrary values:
 *
 * @example
 * const { button, colors, status } = useOrbit()
 *
 * // As Tailwind arbitrary value:
 * <div className={`bg-[${colors.bg}] text-[${colors.text}]`} />
 *
 * // Statically (Tailwind can scan these):
 * <div className="bg-[var(--colors-bg)] text-[var(--colors-text)]" />
 */
export function useOrbit(): OrbitTokens {
  return useContext(OrbitContext)
}
