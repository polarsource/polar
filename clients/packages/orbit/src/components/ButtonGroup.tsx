import { Box } from './Box'
import { Button, type ButtonProps } from './Button'

// An action is derived from the Button API, exposing only what a call-to-action
// needs: its label, its handler, and the async/disabled states. `variant` and
// `size` are deliberately omitted — they are owned by ButtonGroup so emphasis
// and sizing can't collide.
export type ButtonGroupAction = ButtonProps & {
  text: string
}

// A tuple, so the type itself caps the group at two actions: a primary and an
// optional secondary.
export type ButtonGroupActions =
  | readonly [ButtonGroupAction]
  | readonly [ButtonGroupAction, ButtonGroupAction]

export interface ButtonGroupProps {
  /**
   * One or two actions. The first renders as the primary (default) button, the
   * second as a quieter ghost button.
   */
  actions: ButtonGroupActions
  /**
   * Button size applied to every action in the group.
   */
  size?: ButtonProps['size']
}

// The first action is always the primary; any second is the quieter ghost
// companion, so two equally-weighted buttons can never sit side by side.
const variantForIndex = (index: number): ButtonProps['variant'] =>
  index === 0 ? 'default' : 'ghost'

export const ButtonGroup = ({
  actions,
  size = 'default',
}: ButtonGroupProps) => {
  return (
    <Box
      flexDirection={{ base: 'column', sm: 'row' }}
      alignItems={{ base: 'stretch', sm: 'center' }}
      gap="s"
    >
      {actions.map((action, index) => (
        <Button
          key={`${index}-${action.text}`}
          {...action}
          variant={variantForIndex(index)}
          size={size}
        >
          {action.text}
        </Button>
      ))}
    </Box>
  )
}
