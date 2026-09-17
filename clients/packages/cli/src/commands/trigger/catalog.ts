import type { TriggerEvent } from '@/services/trigger'
import * as ui from '@/utils/ui'

export const formatCatalog = (events: ReadonlyArray<TriggerEvent>) => {
  const width = Math.max(0, ...events.map((event) => event.type.length))
  const lines: string[] = [ui.blank]
  let resource = ''
  for (const event of events) {
    const [eventResource = event.type] = event.type.split('.')
    if (eventResource !== resource) {
      if (resource) lines.push(ui.blank)
      resource = eventResource
      lines.push(`  ${ui.bold(resource)}`)
    }
    lines.push(
      `    ${ui.cyan(event.type.padEnd(width))}  ${ui.dim(event.description)}`,
    )
  }
  lines.push(
    ui.blank,
    ui.step(`Send one with ${ui.command('polar trigger <event>')}`),
    ui.blank,
  )
  return lines.join('\n')
}
