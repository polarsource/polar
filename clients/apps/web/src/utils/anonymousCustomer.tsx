import {
  bearFace,
  bee,
  beetleScarab,
  bullHead,
  butterfly,
  catBig,
  chameleon,
  cowHead,
  crab,
  elephant,
  foxFaceTail,
  frogFace,
  hedgehog,
  horseHead,
  owl,
  penguin,
  pig,
  shark,
  spider,
  whale,
} from '@lucide/lab'
import {
  BirdIcon,
  BugIcon,
  CatIcon,
  DogIcon,
  FishIcon,
  Icon,
  PandaIcon,
  RabbitIcon,
  RatIcon,
  ShrimpIcon,
  SnailIcon,
  SquirrelIcon,
  TurtleIcon,
  WormIcon,
} from 'lucide-react'
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

const animals = [
  'Bear',
  'Bee',
  'Beetle',
  'Bird',
  'Bug',
  'Bull',
  'Butterfly',
  'Cat',
  'Chameleon',
  'Cow',
  'Crab',
  'Dog',
  'Elephant',
  'Fish',
  'Fox',
  'Frog',
  'Hedgehog',
  'Horse',
  'Mouse',
  'Owl',
  'Panda',
  'Penguin',
  'Pig',
  'Rabbit',
  'Shark',
  'Shrimp',
  'Snail',
  'Spider',
  'Squirrel',
  'Tiger',
  'Turtle',
  'Whale',
  'Worm',
] as const

export type AnonymousCustomerAdjective = (typeof adjectives)[number]
export type AnonymousCustomerColor = (typeof colors)[number]
export type AnonymousCustomerAnimal = (typeof animals)[number]

export type AnonymousCustomerName =
  `${AnonymousCustomerAdjective} ${AnonymousCustomerColor} ${AnonymousCustomerAnimal}`

export function getAnonymousCustomerName(
  externalId: string,
): [AnonymousCustomerName, AnonymousCustomerColor, AnonymousCustomerAnimal] {
  const getHash = (str: string, seed: number) => {
    let hash = seed
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i)
      hash = hash & hash
    }
    return Math.abs(hash)
  }

  const colorIndex = getHash(externalId, 0) % colors.length
  const animalIndex = getHash(externalId, 3) % animals.length
  const adjectiveIndex = getHash(externalId, 5) % adjectives.length

  const adjective = adjectives[adjectiveIndex]
  const color = colors[colorIndex]
  const animal = animals[animalIndex]

  const name: AnonymousCustomerName = `${adjective} ${color} ${animal}`

  return [name, color, animal]
}

export function useAnonymousCustomerName(
  externalId: string,
): [AnonymousCustomerName, AnonymousCustomerColor, AnonymousCustomerAnimal] {
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

export function renderAnonymousCustomerAnimalIcon(
  animal: AnonymousCustomerAnimal,
  className?: string,
): React.ReactElement {
  const props = { className, strokeWidth: 1.5 }
  switch (animal) {
    case 'Bear':
      return <Icon iconNode={bearFace} {...props} />
    case 'Bee':
      return <Icon iconNode={bee} {...props} />
    case 'Beetle':
      return <Icon iconNode={beetleScarab} {...props} />
    case 'Bird':
      return <BirdIcon {...props} />
    case 'Bug':
      return <BugIcon {...props} />
    case 'Bull':
      return <Icon iconNode={bullHead} {...props} />
    case 'Butterfly':
      return <Icon iconNode={butterfly} {...props} />
    case 'Cat':
      return <CatIcon {...props} />
    case 'Chameleon':
      return <Icon iconNode={chameleon} {...props} />
    case 'Cow':
      return <Icon iconNode={cowHead} {...props} />
    case 'Crab':
      return <Icon iconNode={crab} {...props} />
    case 'Dog':
      return <DogIcon {...props} />
    case 'Elephant':
      return <Icon iconNode={elephant} {...props} />
    case 'Fish':
      return <FishIcon {...props} />
    case 'Fox':
      return <Icon iconNode={foxFaceTail} {...props} />
    case 'Frog':
      return <Icon iconNode={frogFace} {...props} />
    case 'Hedgehog':
      return <Icon iconNode={hedgehog} {...props} />
    case 'Horse':
      return <Icon iconNode={horseHead} {...props} />
    case 'Mouse':
      return <RatIcon {...props} />
    case 'Owl':
      return <Icon iconNode={owl} {...props} />
    case 'Panda':
      return <PandaIcon {...props} />
    case 'Penguin':
      return <Icon iconNode={penguin} {...props} />
    case 'Pig':
      return <Icon iconNode={pig} {...props} />
    case 'Rabbit':
      return <RabbitIcon {...props} />
    case 'Shark':
      return <Icon iconNode={shark} {...props} />
    case 'Shrimp':
      return <ShrimpIcon {...props} />
    case 'Snail':
      return <SnailIcon {...props} />
    case 'Spider':
      return <Icon iconNode={spider} {...props} />
    case 'Squirrel':
      return <SquirrelIcon {...props} />
    case 'Tiger':
      return <Icon iconNode={catBig} {...props} />
    case 'Turtle':
      return <TurtleIcon {...props} />
    case 'Whale':
      return <Icon iconNode={whale} {...props} />
    case 'Worm':
      return <WormIcon {...props} />
  }
}
