import { render } from '@react-email/render'
import { Command } from 'commander'

import emails from './emails'

const program = new Command()

program
  .argument('<template>', 'name of the email template')
  .argument('<props>', 'props to pass to the email template, as a JSON string')
  .action((template: string, props: string) => {
    try {
      const parsedProps = JSON.parse(props)
      const TemplateComponent = emails[template]
      if (!TemplateComponent) {
        console.error(`Template ${template} not found`)
        process.exit(1)
      }
      render(<TemplateComponent {...parsedProps} />).then((html) =>
        console.log(html),
      )
    } catch (error) {
      console.error('Error parsing JSON string:', error)
      process.exit(1)
    }
  })

program.parse(process.argv)
