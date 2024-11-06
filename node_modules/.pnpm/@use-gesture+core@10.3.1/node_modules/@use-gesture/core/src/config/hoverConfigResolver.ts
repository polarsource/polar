import { coordinatesConfigResolver } from './coordinatesConfigResolver'

export const hoverConfigResolver = {
  ...coordinatesConfigResolver,
  mouseOnly: (value = true) => value
}
