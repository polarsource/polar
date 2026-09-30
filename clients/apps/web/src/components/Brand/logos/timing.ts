// The mark's reveal: rays grow out from the centre, the arc follows from its
// middle. Shared by LogoReveal and LogoLoader so the loader is the same motion.
export const LOGO_REVEAL_EASE = [0.48, 0, 0.11, 1] as const
export const LOGO_REVEAL_RAYS = { duration: 0.9, delay: 0 }
export const LOGO_REVEAL_ARC = { duration: 0.8, delay: 0.15 }
