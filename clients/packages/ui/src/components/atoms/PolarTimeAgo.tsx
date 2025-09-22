import TimeAgo from 'react-timeago'

const PolarTimeAgo = (props: { date: Date; suffix?: string }) => {
  return (
    <TimeAgo
      date={props.date}
      formatter={(value: number, unit: string, suffix: string) => {
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
