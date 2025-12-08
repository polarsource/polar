export interface SearchResultBase {
  id: string
  type: string
}

export interface SearchResultProduct extends SearchResultBase {
  type: 'product'
  name: string
  description?: string | null
}

export interface SearchResultCustomer extends SearchResultBase {
  type: 'customer'
  name: string | null
  email: string
}

export interface SearchResultOrder extends SearchResultBase {
  type: 'order'
  customer_name: string | null
  customer_email: string
  product_name: string
  amount: number
}

export interface SearchResultSubscription extends SearchResultBase {
  type: 'subscription'
  customer_name: string | null
  customer_email: string
  product_name: string
  status: string
  amount: number
}

export interface SearchResultPage extends SearchResultBase {
  type: 'page'
  title: string
  url: string
  icon?: React.ReactNode
}

export interface SearchResultAction extends SearchResultBase {
  type: 'action'
  title: string
  url: string
  icon?: React.ReactNode
}

export type SearchResult =
  | SearchResultProduct
  | SearchResultCustomer
  | SearchResultOrder
  | SearchResultSubscription
  | SearchResultPage
  | SearchResultAction
