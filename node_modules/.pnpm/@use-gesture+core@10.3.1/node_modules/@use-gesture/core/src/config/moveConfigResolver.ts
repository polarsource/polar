import { coordinatesConfigResolver } from './coordinatesConfigResolver'

export const moveConfigResolver = {
  ...coordinatesConfigResolver,
  mouseOnly: (value = true) => value
}
