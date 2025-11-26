import {
  BirdIcon,
  BugIcon,
  CatIcon,
  DogIcon,
  FishIcon,
  LucideIcon,
  MouseIcon,
  PandaIcon,
  RabbitIcon,
  ShrimpIcon,
  SnailIcon,
  SquirrelIcon,
  TurtleIcon,
  WormIcon,
} from 'lucide-react'
import { useMemo } from 'react'

export const colors = [
  'Red',
  'Blue',
  'Green',
  'Yellow',
  'Purple',
  'Orange',
  'Pink',
  'Teal',
  'Coral',
  'Indigo',
  'Amber',
  'Crimson',
] as const

export const animals = [
  'Bird',
  'Bug',
  'Cat',
  'Dog',
  'Fish',
  'Panda',
  'Rabbit',
  'Mouse',
  'Shrimp',
  'Snail',
  'Squirrel',
  'Turtle',
  'Worm',
] as const

export type AnonymousCustomerColor = (typeof colors)[number]
export type AnonymousCustomerAnimal = (typeof animals)[number]

export function getAnonymousCustomerName(
  externalId: string,
): [AnonymousCustomerColor, AnonymousCustomerAnimal] {
  const sample = btoa(`${externalId.slice(0, 8)}${externalId.slice(-8)}`)

  let hash = 0
  for (let i = 0; i < sample.length; i++) {
    hash = (hash << 5) - hash + sample.charCodeAt(i)
    hash = hash & hash
  }

  const colorIndex = Math.abs(hash) % colors.length
  const animalIndex = Math.abs(hash >> 8) % animals.length

  return [colors[colorIndex], animals[animalIndex]]
}

export function useAnonymousCustomerName(
  externalId: string,
): [AnonymousCustomerColor, AnonymousCustomerAnimal] {
  return useMemo(() => getAnonymousCustomerName(externalId), [externalId])
}

export function getAnonymousCustomerColorClasses(
  color: AnonymousCustomerColor,
): string {
  switch (color) {
    case 'Red':
      return 'bg-red-500/10 text-red-600'
    case 'Blue':
      return 'bg-blue-500/10 text-blue-600'
    case 'Green':
      return 'bg-green-500/10 text-green-600'
    case 'Yellow':
      return 'bg-yellow-500/10 text-yellow-600'
    case 'Purple':
      return 'bg-purple-500/10 text-purple-600'
    case 'Orange':
      return 'bg-orange-500/10 text-orange-600'
    case 'Pink':
      return 'bg-pink-500/10 text-pink-600'
    case 'Teal':
      return 'bg-teal-500/10 text-teal-600'
    case 'Coral':
      return 'bg-rose-500/10 text-rose-600'
    case 'Indigo':
      return 'bg-indigo-500/10 text-indigo-600'
    case 'Amber':
      return 'bg-amber-500/10 text-amber-600'
    case 'Crimson':
      return 'bg-rose-500/10 text-rose-600'
  }
}

export function useAnonymousCustomerColorClasses(
  color: AnonymousCustomerColor,
): string {
  return useMemo(() => getAnonymousCustomerColorClasses(color), [color])
}

export function getAnonymousCustomerAnimalIcon(
  animal: AnonymousCustomerAnimal,
): LucideIcon {
  switch (animal) {
    case 'Bird':
      return BirdIcon
    case 'Bug':
      return BugIcon
    case 'Cat':
      return CatIcon
    case 'Dog':
      return DogIcon
    case 'Fish':
      return FishIcon
    case 'Panda':
      return PandaIcon
    case 'Rabbit':
      return RabbitIcon
    case 'Mouse':
      return MouseIcon
    case 'Shrimp':
      return ShrimpIcon
    case 'Snail':
      return SnailIcon
    case 'Squirrel':
      return SquirrelIcon
    case 'Turtle':
      return TurtleIcon
    case 'Worm':
      return WormIcon
  }
}

export function renderAnonymousCustomerAnimalIcon(
  animal: AnonymousCustomerAnimal,
  className?: string,
): React.ReactElement {
  const props = { className, strokeWidth: 1.5 }
  switch (animal) {
    case 'Bird':
      return <BirdIcon {...props} />
    case 'Bug':
      return <BugIcon {...props} />
    case 'Cat':
      return <CatIcon {...props} />
    case 'Dog':
      return <DogIcon {...props} />
    case 'Fish':
      return <FishIcon {...props} />
    case 'Panda':
      return <PandaIcon {...props} />
    case 'Rabbit':
      return <RabbitIcon {...props} />
    case 'Mouse':
      return <MouseIcon {...props} />
    case 'Shrimp':
      return <ShrimpIcon {...props} />
    case 'Snail':
      return <SnailIcon {...props} />
    case 'Squirrel':
      return <SquirrelIcon {...props} />
    case 'Turtle':
      return <TurtleIcon {...props} />
    case 'Worm':
      return <WormIcon {...props} />
  }
}
