/**
 * @module upload
 * The PolarUpload class is used to upload Astro articles to Polar via
 * the Polar SDK.
 *
 * Essentially, we generate a list of Polar articles from the Astro articles,
 * and then allow the user to apply a series of functions to the list before
 * uploading them to Polar.
 *
 * The upload happens in the `then` method, which is called by using `await`
 * on the PolarUploadBuilder instance.
 *
 * This allows for a fluent API that is easy to use and understand:
 *
 * ```typescript
 * const result = await polar.upload(articles, options).filter(...).transform(...)
 * ```
 *
 * This is inspired by the [Supabase Client](https://supabase.com/docs/reference/javascript/select),
 * which uses a similar pattern for building queries.
 */
import type { Article, ArticleCreate, ArticleUpdate, Organization, PolarAPI } from '@polar-sh/sdk';
import { ErrorGroup, PolarUploadError, type AstroCollectionEntry, type PolarResult } from './types';

/**
 * A PolarArticle contains all the details required for creating or updating
 * articles via the Polar API.
 */
export type PolarArticle = Omit<ArticleCreate, 'organization_id'> & ArticleUpdate;

/**
 * Information about the current article in the upload pipeline.
 * `entry` is the original Astro article, `article` is the Polar article,
 * and `exists` is a boolean indicating whether the article already exists
 * on Polar.
 */
type UploadBuilderFunctionData<
	TEntry extends AstroCollectionEntry,
	TArticle extends PolarArticle,
> = {
	entry: TEntry;
	article: TArticle;
	exists: boolean;
	existing?: Article;
};

/**
 * @private
 * A function that filters out articles from the list of entries.
 */
type UploadFilterFunction<TEntry extends AstroCollectionEntry, TArticle extends PolarArticle> = (
	data: UploadBuilderFunctionData<TEntry, TArticle>
) => boolean;

/**
 * @private
 * A function that transforms an article from the list of entries.
 * This can be used to modify the article before it is uploaded to Polar.
 */
type UploadTransformFunction<
	TEntry extends AstroCollectionEntry,
	TArticle extends PolarArticle,
	NewTArticle extends PolarArticle,
> = (data: UploadBuilderFunctionData<TEntry, TArticle>) => NewTArticle;

/**
 * @private
 * A definition for a function that can be used in the upload pipeline.
 */
type UploadBuilderFunctionDefinition<TEntry extends AstroCollectionEntry> =
	| {
			type: 'filter';
			function: UploadFilterFunction<TEntry, PolarArticle>;
	  }
	| {
			type: 'transform';
			// Use any here as we don't need to know the return type of the transform function
			function: UploadTransformFunction<TEntry, PolarArticle, any>;
	  };

/**
 * The result from uploading articles to Polar.
 * This contains either lists of created and updated articles, or an error
 * if something went wrong.
 */
export type PolarUploadResult = PolarResult<
	{
		created: Article[];
		updated: Article[];
	},
	PolarUploadError | ErrorGroup<PolarUploadError>
>;

/**
 * Options for uploading articles to Polar.
 */
export type UploadOptions = {
	organizationName: string;
	platform?: 'github';
	showUnpublished?: boolean;
};

/**
 * The PolarUploadBuilder class is used to build a list of Astro articles
 * and upload them to the Polar API.
 */
export class PolarUploadBuilder<
	TEntry extends AstroCollectionEntry,
	TArticle extends PolarArticle = PolarArticle,
> implements PromiseLike<PolarUploadResult>
{
	constructor(
		private client: PolarAPI,
		private entries: TEntry[],
		private options: UploadOptions,
		private pipeline: UploadBuilderFunctionDefinition<TEntry>[] = []
	) {}

	/**
	 * Create a new PolarUploadBuilder with a new function added to the pipeline.
	 */
	private withFunction<NewTArticle extends PolarArticle>(
		func: UploadBuilderFunctionDefinition<TEntry>
	): PolarUploadBuilder<TEntry, NewTArticle> {
		return new PolarUploadBuilder(this.client, this.entries, this.options, [
			...this.pipeline,
			func,
		]);
	}

	/**
	 * Filter out articles from the list of entries.
	 * This function is called for each article in the list, and if it returns
	 * `false`, the article will not be uploaded.
	 */
	public filter(func: UploadFilterFunction<TEntry, TArticle>) {
		return this.withFunction({
			type: 'filter',
			function: func as UploadFilterFunction<TEntry, PolarArticle>,
		});
	}

	/**
	 * Transform articles before uploading them to Polar.
	 * This function is called for each article in the list, and allows you to
	 * modify the article before it is uploaded to Polar.
	 */
	public transform<const NewTArticle extends PolarArticle>(
		func: UploadTransformFunction<TEntry, TArticle, NewTArticle>
	) {
		return this.withFunction<NewTArticle>({
			type: 'transform',
			function: func as UploadTransformFunction<TEntry, PolarArticle, NewTArticle>,
		});
	}

	private async getOrganization(): Promise<PolarResult<Organization, PolarUploadError>> {
		try {
			const response = await this.client.organizations.lookup({
				organizationName: this.options.organizationName,
				platform: this.options.platform ?? 'github',
			});
			return { data: response, error: null };
		} catch (error) {
			if (error instanceof Error) {
				return {
					data: null,
					error: new PolarUploadError(error.message, 500, { cause: error }),
				};
			} else {
				return {
					data: null,
					error: new PolarUploadError(
						'An unknown error occurred while fetching the organization. Does it exist?',
						500,
						{
							cause: error,
						}
					),
				};
			}
		}
	}

	/**
	 * Fetch articles from the Polar API. Automatically paginates through
	 * all the articles in the organization.
	 */
	private async getArticles(): Promise<PolarResult<Article[], PolarUploadError>> {
		const articles: Article[] = [];
		let page = 1;

		while (true) {
			try {
				const response = await this.client.articles.search({
					organizationName: this.options.organizationName,
					showUnpublished: this.options.showUnpublished ?? true,
					platform: this.options.platform ?? 'github',
					page,
					limit: 100,
				});
				articles.push(...response.items!);
				if (response.pagination?.max_page && page < response.pagination.max_page) {
					page++;
				} else {
					break;
				}
			} catch (error) {
				if (error instanceof Error) {
					return {
						data: null,
						error: new PolarUploadError(error.message, 500, { cause: error }),
					};
				} else {
					return {
						data: null,
						error: new PolarUploadError('An unknown error occurred.', 500, {
							cause: error,
						}),
					};
				}
			}
		}
		return { data: articles, error: null };
	}

	/**
	 * Process an entry in the upload pipeline.
	 * This applies all the functions in the pipeline to the entry, and returns
	 * the result. If the entry is filtered out, it will return `null`.
	 */
	private processEntry(
		data: UploadBuilderFunctionData<TEntry, PolarArticle>
	): UploadBuilderFunctionData<TEntry, PolarArticle> | null {
		let result = data;
		for (const func of this.pipeline) {
			if (func.type === 'filter') {
				if (!func.function(result)) {
					return null;
				}
			} else {
				result = {
					...result,
					article: func.function(result),
				};
			}
		}
		return result;
	}

	/**
	 * Create a new article on Polar.
	 */
	private async createArticle(
		article: ArticleCreate
	): Promise<PolarResult<Article, PolarUploadError>> {
		try {
			const response = await this.client.articles.create({
				articleCreate: article,
			});
			return { data: response, error: null };
		} catch (error) {
			if (error instanceof Error) {
				return {
					data: null,
					error: new PolarUploadError(error.message, 500, { cause: error }),
				};
			} else {
				return {
					data: null,
					error: new PolarUploadError('An unknown error occurred.', 500, {
						cause: error,
					}),
				};
			}
		}
	}

	/**
	 * Update an existing article on Polar.
	 */
	private async updateArticle(
		articleId: string,
		article: ArticleUpdate
	): Promise<PolarResult<Article, PolarUploadError>> {
		try {
			const response = await this.client.articles.update({
				id: articleId,
				articleUpdate: article,
			});
			return { data: response, error: null };
		} catch (error) {
			if (error instanceof Error) {
				return {
					data: null,
					error: new PolarUploadError(error.message, 500, { cause: error }),
				};
			} else {
				return {
					data: null,
					error: new PolarUploadError('An unknown error occurred.', 500, {
						cause: error,
					}),
				};
			}
		}
	}

	/**
	 * Upload all the articles to Polar.
	 * This is called by using `await` on the PolarUploadBuilder instance, and
	 * should not be called directly.
	 */
	public async then<TResult1 = PolarUploadResult, TResult2 = never>(
		onfulfilled?:
			| ((value: PolarUploadResult) => TResult1 | PromiseLike<TResult1>)
			| null
			| undefined,
		_onrejected?:
			| ((reason: PolarUploadResult) => TResult2 | PromiseLike<TResult2>)
			| null
			| undefined
	): Promise<TResult1 | TResult2> {
		// Find organization
		const orgResult = await this.getOrganization();
		if (orgResult.error) {
			if (onfulfilled) {
				return onfulfilled(orgResult);
			}
			return orgResult as TResult1;
		}
		const org = orgResult.data;

		// Fetch articles
		const articlesResult = await this.getArticles();
		if (articlesResult.error) {
			if (onfulfilled) {
				return onfulfilled(articlesResult);
			}
			return articlesResult as TResult1;
		}
		const articles = articlesResult.data;

		const toProcess: UploadBuilderFunctionData<TEntry, PolarArticle>[] = this.entries.map(
			(entry) => {
				const existing = articles.find((article) => article.slug === entry.slug);
				return {
					entry,
					exists: !!existing,
					existing,
					article: {
						title: entry.id,
						slug: entry.slug,
						body: entry.body,
					},
				};
			}
		);

		// Process entries
		const processed: TArticle[] = toProcess
			.map((data) => this.processEntry(data)?.article)
			.filter(Boolean) as TArticle[];

		const toCreate = processed.filter((article) => !articles.find((a) => a.slug === article.slug));
		const toUpdate = processed
			.map((article) => {
				const existing = articles.find((a) => a.slug === article.slug);
				return existing ? { article, id: existing.id } : null;
			})
			.filter(Boolean) as { article: TArticle; id: string }[];

		// Create/Update articles
		const createResults = await Promise.all(
			toCreate.map((article) => this.createArticle({ ...article, organization_id: org.id }))
		);
		const updateResults = await Promise.all(
			toUpdate.map(({ article, id }) => this.updateArticle(id, article))
		);

		const errors: PolarUploadError[] = [];
		for (const result of createResults.concat(updateResults)) {
			if (result.error) {
				errors.push(result.error);
			}
		}
		if (errors.length > 0) {
			if (onfulfilled) {
				return onfulfilled({ data: null, error: new ErrorGroup(errors) });
			}
			return { data: null, error: new ErrorGroup(errors) } as TResult1;
		}

		const created: Article[] = [];
		const updated: Article[] = [];

		for (const result of createResults) {
			if (result.data) {
				created.push(result.data);
			}
		}
		for (const result of updateResults) {
			if (result.data) {
				updated.push(result.data);
			}
		}

		const result = { data: { created, updated }, error: null };
		if (onfulfilled) {
			return onfulfilled(result);
		}
		return result as TResult1;
	}
}
