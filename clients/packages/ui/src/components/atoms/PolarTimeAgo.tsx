import TimeAgo from 'react-timeago'

const PolarTimeAgo = (props: { date: Date; suffix?: string }) => {
  return (
    <TimeAgo
      suppressHydrationWarning
      date={props.date}
      formatter={(value, unit, suffix) => {
        if (unit === 'second') {
          return 'just now'
        }
        return `${value} ${unit}${value !== 1 ? 's' : ''} ${
          props.suffix ?? suffix
        }`
      }}
    />
  )
}

export default PolarTimeAgo
