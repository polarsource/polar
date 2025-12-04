import { useMemo } from 'react'

const adjectives = [
  'Happy',
  'Witty',
  'Lucky',
  'Brave',
  'Clever',
  'Mighty',
  'Nimble',
  'Swift',
  'Wise',
  'Gentle',
  'Curious',
  'Daring',
  'Savvy',
  'Crafty',
  'Gritty',
  'Quick',
  'Bold',
  'Jolly',
  'Lively',
] as const

const colors = [
  'Red',
  'Orange',
  'Amber',
  'Yellow',
  'Lime',
  'Green',
  'Emerald',
  'Teal',
  'Cyan',
  'Sky',
  'Blue',
  'Indigo',
  'Violet',
  'Purple',
  'Fuchsia',
  'Pink',
  'Rose',
] as const

const shapes = [
  'Dot',
  'Triangle',
  'Square',
  'Diamond',
  'Pentagon',
  'Hexagon',
  'Octagon',
  'Cube',
  'Pyramid',
  'Torus',
  'Trapezium',
] as const

type AnonymousCustomerAdjective = (typeof adjectives)[number]
type AnonymousCustomerColor = (typeof colors)[number]
type AnonymousCustomerShape = (typeof shapes)[number]

type AnonymousCustomerName =
  `${AnonymousCustomerAdjective} ${AnonymousCustomerColor} ${AnonymousCustomerShape}`

export function getAnonymousCustomerName(
  externalId: string,
): [AnonymousCustomerName, AnonymousCustomerColor, AnonymousCustomerShape] {
  const getHash = (str: string, seed: number) => {
    let hash = seed
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i)
      hash = hash & hash
    }
    return Math.abs(hash)
  }

  const colorIndex = getHash(externalId, 0) % colors.length
  const shapeIndex = getHash(externalId, 3) % shapes.length
  const adjectiveIndex = getHash(externalId, 5) % adjectives.length

  const adjective = adjectives[adjectiveIndex]
  const color = colors[colorIndex]
  const shape = shapes[shapeIndex]

  const name: AnonymousCustomerName = `${adjective} ${color} ${shape}`

  return [name, color, shape]
}

export function useAnonymousCustomerName(
  externalId: string,
): [AnonymousCustomerName, AnonymousCustomerColor, AnonymousCustomerShape] {
  return useMemo(() => getAnonymousCustomerName(externalId), [externalId])
}
