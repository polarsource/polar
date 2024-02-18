import type { ConfigurationParameters } from '@polar-sh/sdk'
import { Configuration, PolarAPI } from '@polar-sh/sdk'
import { PolarUploadBuilder } from './upload'

export class Polar {
  public client: PolarAPI

  constructor(config?: ConfigurationParameters) {
    this.client = new PolarAPI(new Configuration(config))
  }

  upload<TEntry>(entries: TEntry[]) {
    return new PolarUploadBuilder(this.client, entries)
  }
}
