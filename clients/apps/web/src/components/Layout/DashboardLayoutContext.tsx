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

export const useDashboardLayoutContext = () => {
  const [topbarHeight, setTopbarHeight] = useState(0)
  const [isMD, setIsMD] = useState(false)
  return {
    topbarHeight,
    setTopbarHeight,

    isMD,
    setIsMD,
  }
}

const DashboardLayoutContext = createContext(defaultDashboardLayoutContext)

export default DashboardLayoutContext
