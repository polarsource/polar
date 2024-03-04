# Polar SDK

The Polar SDK is a JavaScript library with capabilities to interact with the Polar API.

The SDK is compatible with both browser & server-side runtimes. The API client is automatically generated from our OpenAPI implementation, making it up-to-date with the server-side API at any time.

[Read more about our OpenAPI Schema & documentation](https://docs.polar.sh/api)

## Usage

The SDK is available from NPM.

`npm install @polar-sh/sdk`

Once installed, you may import the SDK like you usually would:

```typescript
import { Configuration, PolarAPI } from '@polar-sh/sdk'

const api = new PolarAPI()

const authedApi = new PolarAPI(
  new Configuration({
    accessToken: '<MY_ACCESS_TOKEN>',
  }),
)
```

### Access Tokens

You can acquire an access token through your [Settings page](https://polar.sh/settings). This can be used to authenticate yourself with the API for create/update/delete actions.

## Examples

### Issues looking for funding

You can easily retrieve issues looking for funding using the Funding-service.

```typescript
import {
  Configuration,
  ListFundingSortBy,
  Platforms,
  PolarAPI,
} from '@polar-sh/sdk'

const api = new PolarAPI(new Configuration())

const issuesFunding = await api.funding.search({
  platform: Platforms.GITHUB,
  organizationName: '<MY_GITHUB_ORGANIZATION_NAME>',
  badged: true,
  closed: false,
  sorting: [
    ListFundingSortBy.MOST_FUNDED,
    ListFundingSortBy.MOST_ENGAGEMENT,
    ListFundingSortBy.NEWEST,
  ],
  limit: 20,
})
```

### Issue data from GitHub Issue

Retrieve Polar data about a given GitHub issue.

```typescript
import { Configuration, PolarAPI } from '@polar-sh/sdk'

const api = new PolarAPI(new Configuration())

const params = {
  organization: 'polarsource',
  repo: 'polar',
  number: 900,
}

const issue = await api.issues.lookup({
  externalUrl: `https://github.com/${params.organization}/${params.repo}/issues/${params.number}`,
})
```

### Add Polar badge to a GitHub issue

Adds a Polar badge to a given GitHub issue.

```typescript
import { Configuration, PolarAPI } from '@polar-sh/sdk'

const api = new PolarAPI(
  new Configuration({
    accessToken: '<MY_ACCESS_TOKEN>',
  }),
)

await api.issues.addPolarBadge({
  id: '<ISSUE_ID>',
})
```
