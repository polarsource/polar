import { Box } from '@polar-sh/orbit/Box'

export const SkeletonBar = ({
  width,
  height = 12,
}: {
  width: number | string
  height?: number
}) => (
  <div className="animate-pulse">
    <Box
      width={width}
      height={height}
      borderRadius="s"
      backgroundColor="background-card"
    />
  </div>
)
