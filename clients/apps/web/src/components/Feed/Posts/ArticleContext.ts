import { Article } from '@polar-sh/sdk'
import { createContext } from 'react'

type Context = {
  article?: Article
}

export const ArticleContext = createContext<Context>({})
