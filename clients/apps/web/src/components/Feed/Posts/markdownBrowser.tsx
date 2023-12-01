import BrowserPoll from './BrowserPoll'
import Poll from './Poll'
import { markdownOpts } from './markdown'

export const markdownBrowserOpts = {
  ...markdownOpts,
  overrides: {
    ...markdownOpts.overrides,

    // browser overrides
    poll: (args: any) => <Poll {...args} renderer={BrowserPoll} />,
  },
} as const
