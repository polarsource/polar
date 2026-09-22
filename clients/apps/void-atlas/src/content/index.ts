import type { Lesson, Planned } from '@/lesson/types'
import { ambientLesson } from './ambient'
import { configLesson } from './config'
import { deployLesson } from './deploy'
import { identitiesLesson } from './identities'
import { llmLesson } from './llm'
import { localEventsLesson } from './local-events'
import { metersLesson } from './meters'
import { reducersLesson } from './reducers'
import { scenariosLesson } from './scenarios'
import { signalsLesson } from './signals'

export const lessons: readonly Lesson[] = [
  configLesson,
  reducersLesson,
  metersLesson,
  identitiesLesson,
  ambientLesson,
  signalsLesson,
  llmLesson,
  localEventsLesson,
  deployLesson,
  scenariosLesson,
]

export const planned: readonly Planned[] = []
