/**
 * @module upload
 * The PolarUpload class is used to upload Astro articles to Polar via
 * the Polar SDK.
 */
import type { Article, ArticleUpdate, ArticleCreate, PolarAPI } from '@polar-sh/sdk'
import { type AstroCollectionEntry, PolarUploadError, ErrorGroup, type PolarResult } from './types'

/**
 * A PolarArticle contains all the details required for creating or updating
 * articles via the Polar API.
 */
export type PolarArticle = ArticleCreate & ArticleUpdate

type UploadBuilderFunctionData<TEntry extends AstroCollectionEntry, TArticle extends PolarArticle> = {
  entry: TEntry
  article: TArticle
  exists: boolean
}

type UploadFilterFunction<TEntry extends AstroCollectionEntry, TArticle extends PolarArticle> = (
  data: UploadBuilderFunctionData<TEntry, TArticle>,
) => boolean

type UploadTransformFunction<
  TEntry extends AstroCollectionEntry,
  TArticle extends PolarArticle,
  NewTArticle extends PolarArticle,
> = (data: UploadBuilderFunctionData<TEntry, TArticle>) => NewTArticle

type _UploadBuilderFunctionDefinition<TEntry extends AstroCollectionEntry> =
  | {
    type: 'filter'
    function: UploadFilterFunction<TEntry, PolarArticle>
  }
  | {
    type: 'transform'
    // Use any here as we don't need to know the return type of the transform function
    function: UploadTransformFunction<TEntry, PolarArticle, any>
  }

type UploadResult = PolarResult<{
  created: Article[]
  updated: Article[]
}, PolarUploadError | ErrorGroup<PolarUploadError>>

export type UploadOptions = {
  organizationId: string
  organizationName: string
  platform?: 'github'
  showUnpublished?: boolean
}

export class PolarUploadBuilder<
  TEntry extends AstroCollectionEntry,
  TArticle extends PolarArticle = PolarArticle,
> implements PromiseLike<UploadResult> {
  constructor(
    private client: PolarAPI,
    private entries: TEntry[],
    private options: UploadOptions,
    private pipeline: _UploadBuilderFunctionDefinition<TEntry>[] = [],
  ) { }

  private withFunction<NewTArticle extends PolarArticle>(
    func: _UploadBuilderFunctionDefinition<TEntry>,
  ): PolarUploadBuilder<TEntry, NewTArticle> {
    return new PolarUploadBuilder(this.client, this.entries, this.options, [
      ...this.pipeline,
      func,
    ])
  }

  public filter(func: UploadFilterFunction<TEntry, TArticle>) {
    return this.withFunction({
      type: 'filter',
      function: func as UploadFilterFunction<TEntry, PolarArticle>,
    })
  }

  private async getArticles(): Promise<PolarResult<Article[], PolarUploadError>> {
    const articles: Article[] = []
    let page = 1

    while (true) {
      try {
        const response = await this.client.articles.search({
          organizationName: this.options.organizationName,
          showUnpublished: this.options.showUnpublished ?? true,
          platform: this.options.platform ?? 'github',
          page,
          limit: 100,
        })
        articles.push(...response.items!)
        if (response.pagination?.max_page && page < response.pagination.max_page) {
          page++
        } else {
          break
        }
      } catch (error) {
        if (error instanceof Error) {
          return {
            data: null,
            error: new PolarUploadError(error.message, 500, { cause: error })
          }
        } else {
          return {
            data: null,
            error: new PolarUploadError('An unknown error occurred.', 500, { cause: error })
          }
        }
      }
    }
    return { data: articles, error: null }
  }

  public transform<NewTArticle extends PolarArticle>(
    func: UploadTransformFunction<TEntry, TArticle, NewTArticle>,
  ) {
    return this.withFunction<NewTArticle>({
      type: 'transform',
      function: func as UploadTransformFunction<
        TEntry,
        PolarArticle,
        NewTArticle
      >,
    })
  }

  private processEntry(data: UploadBuilderFunctionData<TEntry, PolarArticle>): UploadBuilderFunctionData<TEntry, PolarArticle> | null {
    let result = data
    for (const func of this.pipeline) {
      if (func.type === 'filter') {
        if (!func.function(result)) {
          return null
        }
      } else {
        result = {
          ...result,
          article: func.function(result),
        }
      }
    }
    return result
  }

  private async createArticle(article: ArticleCreate): Promise<PolarResult<Article, PolarUploadError>> {
    try {
      const response = await this.client.articles.create({ articleCreate: article })
      return { data: response, error: null }
    } catch (error) {
      if (error instanceof Error) {
        return { data: null, error: new PolarUploadError(error.message, 500, { cause: error }) }
      } else {
        return { data: null, error: new PolarUploadError('An unknown error occurred.', 500, { cause: error }) }
      }
    }
  }

  private async updateArticle(articleId: string, article: ArticleUpdate): Promise<PolarResult<Article, PolarUploadError>> {
    try {
      const response = await this.client.articles.update({ id: articleId, articleUpdate: article })
      return { data: response, error: null }
    } catch (error) {
      if (error instanceof Error) {
        return { data: null, error: new PolarUploadError(error.message, 500, { cause: error }) }
      } else {
        return { data: null, error: new PolarUploadError('An unknown error occurred.', 500, { cause: error }) }
      }
    }
  }

  public async then<TResult1 = UploadResult, TResult2 = never>(
    onfulfilled?: ((value: UploadResult) => TResult1 | PromiseLike<TResult1>) | null | undefined,
    onrejected?: ((reason: UploadResult) => TResult2 | PromiseLike<TResult2>) | null | undefined,
  ): Promise<TResult1 | TResult2> {
    // Fetch articles
    const articlesResult = await this.getArticles()
    if (articlesResult.error) {
      if (onrejected) {
        return onrejected(articlesResult)
      }
      return Promise.reject(articlesResult)
    }
    const articles = articlesResult.data

    const toProcess: UploadBuilderFunctionData<TEntry, PolarArticle>[] = this.entries.map((entry) => {
      return {
        entry,
        exists: !!articles.find((article) => article.slug === entry.slug),
        article: {
          title: entry.title,
          slug: entry.slug,
          body: entry.body,
          organization_id: this.options.organizationId,
        },
      }
    })

    // Process entries
    const processed: TArticle[] = toProcess.map((data) => this.processEntry(data)?.article).filter(Boolean) as TArticle[]

    const toCreate = processed.filter((article) => !articles.find((a) => a.slug === article.slug))
    const toUpdate = processed.map((article) => {
      const existing = articles.find((a) => a.slug === article.slug)
      return existing ? { article, id: existing.id } : null
    }).filter(Boolean) as { article: TArticle, id: string }[]

    // Create/Update articles
    const createResults = await Promise.all(toCreate.map((article) => this.createArticle(article)))
    const updateResults = await Promise.all(toUpdate.map(({ article, id }) => this.updateArticle(id, article)))

    const errors: PolarUploadError[] = []
    for (const result of createResults.concat(updateResults)) {
      if (result.error) {
        errors.push(result.error)
      }
    }
    if (errors.length > 0) {
      if (onrejected) {
        return onrejected({ data: null, error: new ErrorGroup(errors) })
      }
      return Promise.reject({ data: null, error: new ErrorGroup(errors) })
    }

    const created: Article[] = []
    const updated: Article[] = []

    for (const result of createResults) {
      if (result.data) {
        created.push(result.data)
      }
    }
    for (const result of updateResults) {
      if (result.data) {
        updated.push(result.data)
      }
    }

    const result = { data: { created, updated }, error: null }
    if (onfulfilled) {
      return onfulfilled(result)
    }
    return result as TResult1
  }
}
