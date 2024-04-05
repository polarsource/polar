import { createContext, useState } from 'react'

const defaultDashboardLayoutContext: {
  isMD: boolean
  setIsMD: (v: boolean) => void

  topbarHeight: number
  setTopbarHeight: (v: number) => void
} = {
  topbarHeight: 0,
  setTopbarHeight: (v: number) => {},

  isMD: false,
  setIsMD: (v: boolean) => {},
}

const DEFAULT_DESKTOP_HEIGHT = 79
const DEFAULT_MOBILE_HEIGHT = 0

export const useDashboardLayoutContext = (probablyIsMDOrLarger: boolean) => {
  // Using probabilistic values here
  // Will be updated with real values from <Topbar> once initialized on the client
  const [topbarHeight, setTopbarHeight] = useState(
    probablyIsMDOrLarger ? DEFAULT_DESKTOP_HEIGHT : DEFAULT_MOBILE_HEIGHT,
  )

  const [isMD, setIsMD] = useState(probablyIsMDOrLarger)

  return {
    topbarHeight,
    setTopbarHeight,

    isMD,
    setIsMD,
  }
}

const DashboardLayoutContext = createContext(defaultDashboardLayoutContext)

export default DashboardLayoutContext
