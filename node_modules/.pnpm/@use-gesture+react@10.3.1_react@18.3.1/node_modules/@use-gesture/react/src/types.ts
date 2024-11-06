import { DOMHandlers } from '@use-gesture/core/types'

export type ReactDOMAttributes = {
  [Key in keyof DOMHandlers]: React.DOMAttributes<EventTarget>[Key]
}
