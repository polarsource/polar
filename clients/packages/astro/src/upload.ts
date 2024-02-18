/**
 * @module upload
 * The PolarUpload class is used to upload Astro articles to Polar via
 * the Polar SDK.
 */
import type { PolarAPI } from '@polar-sh/sdk'
import type { ArticleCreate, ArticleUpdate } from '@polar-sh/sdk'
// import type { } from 'astro:content'

/**
 * A PolarArticle contains all the details required for creating or updating
 * articles via the Polar API.
 */
export type PolarArticle = ArticleCreate & ArticleUpdate

type UploadBuilderFunctionData<TEntry, TArticle extends PolarArticle> = {
  entry: TEntry,
  article: TArticle
  exists: boolean
}
type UploadFilterFunction<TEntry, TArticle extends PolarArticle> = (data: UploadBuilderFunctionData<TEntry, TArticle>) => boolean
type UploadTransformFunction<TEntry, TArticle extends PolarArticle, NewTArticle extends PolarArticle> = (data: UploadBuilderFunctionData<TEntry, TArticle>) => NewTArticle

type _UploadBuilderFunctionDefinition<TEntry> = {
  type: 'filter',
  function: UploadFilterFunction<TEntry, PolarArticle>
} | {
  type: 'transform',
  // Use any here as we don't need to know the return type of the transform function
  function: UploadTransformFunction<TEntry, PolarArticle, any>
}

// TODO: Make TEntry extend an Astro collection content type
export class PolarUploadBuilder<TEntry, TArticle extends PolarArticle = PolarArticle> {
  constructor(
    private client: PolarAPI,
    private entries: TEntry[],
    private pipeline: _UploadBuilderFunctionDefinition<TEntry>[] = []
  ) { }

  private withFunction<NewTArticle extends PolarArticle>(
    builder: PolarUploadBuilder<TEntry, TArticle>,
    func: _UploadBuilderFunctionDefinition<TEntry>
  ): PolarUploadBuilder<TEntry, NewTArticle> {
    return new PolarUploadBuilder(this.client, this.entries, [...this.pipeline, func])
  }

  public filter(func: UploadFilterFunction<TEntry, TArticle>) {
    return this.withFunction(this, { type: 'filter', function: func as UploadFilterFunction<TEntry, PolarArticle> })
  }

  public transform<NewTArticle extends PolarArticle>(func: UploadTransformFunction<TEntry, TArticle, NewTArticle>) {
    return this.withFunction<NewTArticle>(this, { type: 'transform', function: func as UploadTransformFunction<TEntry, PolarArticle, NewTArticle> })
  }
}
