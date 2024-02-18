import type { ConfigurationParameters } from '@polar-sh/sdk'
import { Configuration, PolarAPI } from '@polar-sh/sdk'
import type { AstroCollectionEntry } from './types'
import { PolarUploadBuilder, type UploadOptions } from './upload'

export class Polar {
  public client: PolarAPI

  constructor(config?: ConfigurationParameters) {
    this.client = new PolarAPI(new Configuration(config))
  }

  upload<TEntry extends AstroCollectionEntry>(
    entries: TEntry[],
    options: UploadOptions,
  ) {
    return new PolarUploadBuilder(this.client, entries, options)
  }
}
