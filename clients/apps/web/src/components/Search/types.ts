import { schemas } from '@polar-sh/client'

type SearchResultItem = schemas['SearchResults']['results'][number]

export interface SearchResultPage {
  id: string
  type: 'page'
  title: string
  url: string
  icon?: React.ReactNode
}

export interface SearchResultAction {
  id: string
  type: 'action'
  title: string
  url: string
  icon?: React.ReactNode
}

export type SearchResult =
  | SearchResultItem
  | SearchResultPage
  | SearchResultAction
