# Polar API

> Version 0.1.0


Welcome to the **Polar API** for [polar.sh](https://polar.sh).

The Public API is currently a [work in progress](https://github.com/polarsource/polar/issues/834) and is in active development. 🚀

#### Authentication

Use a [Personal Access Token](https://polar.sh/settings) and send it in the `Authorization` header on the format `Bearer [YOUR_TOKEN]`.

#### Feedback

If you have any feedback or comments, reach out in the [Polar API-issue](https://github.com/polarsource/polar/issues/834), or reach out on the Polar Discord server.

We'd love to see what you've built with the API and to get your thoughts on how we can make the API better!

#### Connecting

The Polar API is online at `https://api.polar.sh`.


## Path Table

| Method | Path | Description |
| --- | --- | --- |
| GET | [/healthz](#gethealthz) | Healthz |
| GET | [/readyz](#getreadyz) | Readyz |
| GET | [/api/v1/users/me](#getapiv1usersme) | Get Authenticated |
| PUT | [/api/v1/users/me](#putapiv1usersme) | Update Preferences |
| POST | [/api/v1/users/me/token](#postapiv1usersmetoken) | Create Token |
| GET | [/api/v1/users/logout](#getapiv1userslogout) | Logout |
| POST | [/api/v1/users/me/stripe_customer_portal](#postapiv1usersmestripe_customer_portal) | Create Stripe Customer Portal |
| GET | [/api/v1/integrations/github/authorize](#getapiv1integrationsgithubauthorize) | Github Authorize |
| GET | [/api/v1/integrations/github/callback](#getapiv1integrationsgithubcallback) | Github Callback |
| GET | [/api/v1/integrations/github/{org}/{repo}/issues/{number}/badges/{badge_type}](#getapiv1integrationsgithuborgrepoissuesnumberbadgesbadge_type) | Get Badge Settings |
| POST | [/api/v1/integrations/github/lookup_user](#postapiv1integrationsgithublookup_user) | Lookup User |
| POST | [/api/v1/integrations/github/installations](#postapiv1integrationsgithubinstallations) | Install |
| POST | [/api/v1/integrations/github/webhook](#postapiv1integrationsgithubwebhook) | Webhook |
| GET | [/api/v1/integrations/stripe/return](#getapiv1integrationsstripereturn) | Stripe Connect Return |
| GET | [/api/v1/integrations/stripe/refresh](#getapiv1integrationsstriperefresh) | Stripe Connect Refresh |
| POST | [/api/v1/integrations/stripe/webhook](#postapiv1integrationsstripewebhook) | Webhook |
| GET | [/api/v1/backoffice/pledges](#getapiv1backofficepledges) | Pledges |
| GET | [/api/v1/backoffice/rewards/by_issue](#getapiv1backofficerewardsby_issue) | Rewards |
| GET | [/api/v1/backoffice/rewards/pending](#getapiv1backofficerewardspending) | Rewards Pending |
| GET | [/api/v1/backoffice/issue/{id}](#getapiv1backofficeissueid) | Issue |
| POST | [/api/v1/backoffice/pledges/approve](#postapiv1backofficepledgesapprove) | Pledge Reward Transfer |
| POST | [/api/v1/backoffice/pledges/create_invoice/{pledge_id}](#postapiv1backofficepledgescreate_invoicepledge_id) | Pledge Create Invoice |
| POST | [/api/v1/backoffice/pledges/mark_disputed/{pledge_id}](#postapiv1backofficepledgesmark_disputedpledge_id) | Pledge Mark Disputed |
| POST | [/api/v1/backoffice/organization/sync/{name}](#postapiv1backofficeorganizationsyncname) | Organization Sync |
| POST | [/api/v1/backoffice/badge](#postapiv1backofficebadge) | Manage Badge |
| GET | [/api/v1/dashboard/personal](#getapiv1dashboardpersonal) | Get Personal Dashboard |
| GET | [/api/v1/dashboard/{platform}/{org_name}](#getapiv1dashboardplatformorg_name) | Get Dashboard |
| GET | [/api/v1/dashboard/dummy_do_not_use](#getapiv1dashboarddummy_do_not_use) | Dummy Do Not Use |
| GET | [/api/v1/extension/{platform}/{org_name}/{repo_name}/issues](#getapiv1extensionplatformorg_namerepo_nameissues) | List Issues For Extension |
| GET | [/api/v1/funding/search](#getapiv1fundingsearch) | Search |
| GET | [/api/v1/funding/lookup](#getapiv1fundinglookup) | Lookup |
| POST | [/api/v1/magic_link/request](#postapiv1magic_linkrequest) | Request Magic Link |
| POST | [/api/v1/magic_link/authenticate](#postapiv1magic_linkauthenticate) | Authenticate Magic Link |
| GET | [/api/v1/notifications](#getapiv1notifications) | Get |
| POST | [/api/v1/notifications/read](#postapiv1notificationsread) | Mark Read |
| GET | [/api/v1/repositories](#getapiv1repositories) | List repositories (Public API) |
| GET | [/api/v1/repositories/search](#getapiv1repositoriessearch) | Search repositories (Public API) |
| GET | [/api/v1/repositories/lookup](#getapiv1repositorieslookup) | Lookup repositories (Public API) |
| GET | [/api/v1/repositories/{id}](#getapiv1repositoriesid) | Get a repository (Public API) |
| GET | [/api/v1/rewards/search](#getapiv1rewardssearch) | Search rewards (Public API) |
| GET | [/api/v1/rewards/summary](#getapiv1rewardssummary) | Get rewards summary (Public API) |
| DELETE | [/api/v1/personal_access_tokens/{id}](#deleteapiv1personal_access_tokensid) | Delete a personal access tokens (Public API) |
| GET | [/api/v1/personal_access_tokens](#getapiv1personal_access_tokens) | List personal access tokens (Public API) |
| POST | [/api/v1/personal_access_tokens](#postapiv1personal_access_tokens) | Create a new personal access token (Public API) |
| GET | [/api/v1/payment_methods](#getapiv1payment_methods) | List |
| POST | [/api/v1/payment_methods/{id}/detach](#postapiv1payment_methodsiddetach) | Detach |
| GET | [/api/v1/pull_requests/search](#getapiv1pull_requestssearch) | Search pull requests (Public API) |
| GET | [/api/v1/accounts/search](#getapiv1accountssearch) | Search |
| GET | [/api/v1/accounts/{id}](#getapiv1accountsid) | Get |
| POST | [/api/v1/accounts/{id}/onboarding_link](#postapiv1accountsidonboarding_link) | Onboarding Link |
| POST | [/api/v1/accounts/{id}/dashboard_link](#postapiv1accountsiddashboard_link) | Dashboard Link |
| POST | [/api/v1/accounts](#postapiv1accounts) | Create |
| GET | [/api/v1/issues/search](#getapiv1issuessearch) | Search issues (Public API) |
| GET | [/api/v1/issues/lookup](#getapiv1issueslookup) | Lookup |
| GET | [/api/v1/issues/{id}/body](#getapiv1issuesidbody) | Get Body |
| GET | [/api/v1/issues/for_you](#getapiv1issuesfor_you) | For You |
| GET | [/api/v1/issues/{id}](#getapiv1issuesid) | Get issue (Public API) |
| POST | [/api/v1/issues/{id}](#postapiv1issuesid) | Update issue. (Public API) |
| POST | [/api/v1/issues/{id}/confirm_solved](#postapiv1issuesidconfirm_solved) | Mark an issue as confirmed solved. (Public API) |
| POST | [/api/v1/issues/{id}/add_badge](#postapiv1issuesidadd_badge) | Add Polar Badge |
| POST | [/api/v1/issues/{id}/remove_badge](#postapiv1issuesidremove_badge) | Remove Polar Badge |
| POST | [/api/v1/issues/{id}/comment](#postapiv1issuesidcomment) | Add Issue Comment |
| POST | [/api/v1/issues/{id}/badge_with_message](#postapiv1issuesidbadge_with_message) | Badge With Message |
| GET | [/api/v1/pledges/search](#getapiv1pledgessearch) | Search pledges (Public API) |
| GET | [/api/v1/pledges/summary](#getapiv1pledgessummary) | Get pledges summary (Public API) |
| GET | [/api/v1/pledges/{id}](#getapiv1pledgesid) | Get pledge (Public API) |
| POST | [/api/v1/pledges](#postapiv1pledges) | Create |
| POST | [/api/v1/pledges/pay_on_completion](#postapiv1pledgespay_on_completion) | Create Pay On Completion |
| POST | [/api/v1/pledges/{id}/create_invoice](#postapiv1pledgesidcreate_invoice) | Create Invoice |
| POST | [/api/v1/pledges/payment_intent](#postapiv1pledgespayment_intent) | Create Payment Intent |
| PATCH | [/api/v1/pledges/payment_intent/{id}](#patchapiv1pledgespayment_intentid) | Update Payment Intent |
| POST | [/api/v1/pledges/{pledge_id}/dispute](#postapiv1pledgespledge_iddispute) | Dispute Pledge |
| GET | [/api/v1/user/stream](#getapiv1userstream) | User Stream |
| GET | [/api/v1/{platform}/{org_name}/stream](#getapiv1platformorg_namestream) | User Org Stream |
| GET | [/api/v1/{platform}/{org_name}/{repo_name}/stream](#getapiv1platformorg_namerepo_namestream) | User Org Repo Stream |
| GET | [/api/v1/organizations](#getapiv1organizations) | List organizations (Public API) |
| GET | [/api/v1/organizations/search](#getapiv1organizationssearch) | Search organizations (Public API) |
| GET | [/api/v1/organizations/lookup](#getapiv1organizationslookup) | Lookup organization (Public API) |
| GET | [/api/v1/organizations/{id}](#getapiv1organizationsid) | Get organization (Public API) |
| GET | [/api/v1/organizations/{id}/badge_settings](#getapiv1organizationsidbadge_settings) | Get badge settings (Internal API) |
| POST | [/api/v1/organizations/{id}/badge_settings](#postapiv1organizationsidbadge_settings) | Update badge settings (Internal API) |

## Reference Table

| Name | Path | Description |
| --- | --- | --- |
| Account | [#/components/schemas/Account](#componentsschemasaccount) |  |
| AccountCreate | [#/components/schemas/AccountCreate](#componentsschemasaccountcreate) |  |
| AccountLink | [#/components/schemas/AccountLink](#componentsschemasaccountlink) |  |
| AccountType | [#/components/schemas/AccountType](#componentsschemasaccounttype) | An enumeration. |
| Assignee | [#/components/schemas/Assignee](#componentsschemasassignee) |  |
| Author | [#/components/schemas/Author](#componentsschemasauthor) |  |
| AuthorizationResponse | [#/components/schemas/AuthorizationResponse](#componentsschemasauthorizationresponse) |  |
| BackofficeBadge | [#/components/schemas/BackofficeBadge](#componentsschemasbackofficebadge) |  |
| BackofficeBadgeResponse | [#/components/schemas/BackofficeBadgeResponse](#componentsschemasbackofficebadgeresponse) |  |
| BackofficePledge | [#/components/schemas/BackofficePledge](#componentsschemasbackofficepledge) |  |
| BackofficeReward | [#/components/schemas/BackofficeReward](#componentsschemasbackofficereward) |  |
| ConfirmIssue | [#/components/schemas/ConfirmIssue](#componentsschemasconfirmissue) |  |
| ConfirmIssueSplit | [#/components/schemas/ConfirmIssueSplit](#componentsschemasconfirmissuesplit) |  |
| CreatePersonalAccessToken | [#/components/schemas/CreatePersonalAccessToken](#componentsschemascreatepersonalaccesstoken) |  |
| CreatePersonalAccessTokenResponse | [#/components/schemas/CreatePersonalAccessTokenResponse](#componentsschemascreatepersonalaccesstokenresponse) |  |
| CreatePledgeFromPaymentIntent | [#/components/schemas/CreatePledgeFromPaymentIntent](#componentsschemascreatepledgefrompaymentintent) |  |
| CreatePledgePayLater | [#/components/schemas/CreatePledgePayLater](#componentsschemascreatepledgepaylater) |  |
| CurrencyAmount | [#/components/schemas/CurrencyAmount](#componentsschemascurrencyamount) |  |
| Entry_Any_ | [#/components/schemas/Entry_Any_](#componentsschemasentry_any_) |  |
| Entry_Issue_ | [#/components/schemas/Entry_Issue_](#componentsschemasentry_issue_) |  |
| ExternalGitHubCommitReference | [#/components/schemas/ExternalGitHubCommitReference](#componentsschemasexternalgithubcommitreference) |  |
| ExternalGitHubPullRequestReference | [#/components/schemas/ExternalGitHubPullRequestReference](#componentsschemasexternalgithubpullrequestreference) |  |
| Funding | [#/components/schemas/Funding](#componentsschemasfunding) |  |
| GithubBadgeRead | [#/components/schemas/GithubBadgeRead](#componentsschemasgithubbadgeread) |  |
| GithubUser | [#/components/schemas/GithubUser](#componentsschemasgithubuser) |  |
| HTTPValidationError | [#/components/schemas/HTTPValidationError](#componentsschemashttpvalidationerror) |  |
| InstallationCreate | [#/components/schemas/InstallationCreate](#componentsschemasinstallationcreate) |  |
| Issue | [#/components/schemas/Issue](#componentsschemasissue) |  |
| IssueExtensionRead | [#/components/schemas/IssueExtensionRead](#componentsschemasissueextensionread) |  |
| IssueFunding | [#/components/schemas/IssueFunding](#componentsschemasissuefunding) |  |
| IssueListResponse | [#/components/schemas/IssueListResponse](#componentsschemasissuelistresponse) |  |
| IssueListType | [#/components/schemas/IssueListType](#componentsschemasissuelisttype) | An enumeration. |
| IssueReferenceRead | [#/components/schemas/IssueReferenceRead](#componentsschemasissuereferenceread) |  |
| IssueReferenceType | [#/components/schemas/IssueReferenceType](#componentsschemasissuereferencetype) | An enumeration. |
| IssueSortBy | [#/components/schemas/IssueSortBy](#componentsschemasissuesortby) | An enumeration. |
| IssueStatus | [#/components/schemas/IssueStatus](#componentsschemasissuestatus) | An enumeration. |
| IssueUpdateBadgeMessage | [#/components/schemas/IssueUpdateBadgeMessage](#componentsschemasissueupdatebadgemessage) |  |
| Label | [#/components/schemas/Label](#componentsschemaslabel) |  |
| ListFundingSortBy | [#/components/schemas/ListFundingSortBy](#componentsschemaslistfundingsortby) | An enumeration. |
| ListResource_Account_ | [#/components/schemas/ListResource_Account_](#componentsschemaslistresource_account_) |  |
| ListResource_BackofficeReward_ | [#/components/schemas/ListResource_BackofficeReward_](#componentsschemaslistresource_backofficereward_) |  |
| ListResource_IssueFunding_ | [#/components/schemas/ListResource_IssueFunding_](#componentsschemaslistresource_issuefunding_) |  |
| ListResource_Issue_ | [#/components/schemas/ListResource_Issue_](#componentsschemaslistresource_issue_) |  |
| ListResource_Organization_ | [#/components/schemas/ListResource_Organization_](#componentsschemaslistresource_organization_) |  |
| ListResource_PaymentMethod_ | [#/components/schemas/ListResource_PaymentMethod_](#componentsschemaslistresource_paymentmethod_) |  |
| ListResource_PersonalAccessToken_ | [#/components/schemas/ListResource_PersonalAccessToken_](#componentsschemaslistresource_personalaccesstoken_) |  |
| ListResource_Pledge_ | [#/components/schemas/ListResource_Pledge_](#componentsschemaslistresource_pledge_) |  |
| ListResource_PullRequest_ | [#/components/schemas/ListResource_PullRequest_](#componentsschemaslistresource_pullrequest_) |  |
| ListResource_Repository_ | [#/components/schemas/ListResource_Repository_](#componentsschemaslistresource_repository_) |  |
| ListResource_Reward_ | [#/components/schemas/ListResource_Reward_](#componentsschemaslistresource_reward_) |  |
| LoginResponse | [#/components/schemas/LoginResponse](#componentsschemasloginresponse) |  |
| LogoutResponse | [#/components/schemas/LogoutResponse](#componentsschemaslogoutresponse) |  |
| LookupUserRequest | [#/components/schemas/LookupUserRequest](#componentsschemaslookupuserrequest) |  |
| MagicLinkRequest | [#/components/schemas/MagicLinkRequest](#componentsschemasmagiclinkrequest) |  |
| MaintainerPledgeConfirmationPendingNotification | [#/components/schemas/MaintainerPledgeConfirmationPendingNotification](#componentsschemasmaintainerpledgeconfirmationpendingnotification) |  |
| MaintainerPledgeCreatedNotification | [#/components/schemas/MaintainerPledgeCreatedNotification](#componentsschemasmaintainerpledgecreatednotification) |  |
| MaintainerPledgePaidNotification | [#/components/schemas/MaintainerPledgePaidNotification](#componentsschemasmaintainerpledgepaidnotification) |  |
| MaintainerPledgePendingNotification | [#/components/schemas/MaintainerPledgePendingNotification](#componentsschemasmaintainerpledgependingnotification) |  |
| MaintainerPledgedIssueConfirmationPendingNotification | [#/components/schemas/MaintainerPledgedIssueConfirmationPendingNotification](#componentsschemasmaintainerpledgedissueconfirmationpendingnotification) |  |
| MaintainerPledgedIssuePendingNotification | [#/components/schemas/MaintainerPledgedIssuePendingNotification](#componentsschemasmaintainerpledgedissuependingnotification) |  |
| NotificationRead | [#/components/schemas/NotificationRead](#componentsschemasnotificationread) |  |
| NotificationType | [#/components/schemas/NotificationType](#componentsschemasnotificationtype) | An enumeration. |
| NotificationsList | [#/components/schemas/NotificationsList](#componentsschemasnotificationslist) |  |
| NotificationsMarkRead | [#/components/schemas/NotificationsMarkRead](#componentsschemasnotificationsmarkread) |  |
| OAuthAccountRead | [#/components/schemas/OAuthAccountRead](#componentsschemasoauthaccountread) |  |
| Organization | [#/components/schemas/Organization](#componentsschemasorganization) |  |
| OrganizationBadgeSettingsRead | [#/components/schemas/OrganizationBadgeSettingsRead](#componentsschemasorganizationbadgesettingsread) |  |
| OrganizationBadgeSettingsUpdate | [#/components/schemas/OrganizationBadgeSettingsUpdate](#componentsschemasorganizationbadgesettingsupdate) |  |
| OrganizationPrivateRead | [#/components/schemas/OrganizationPrivateRead](#componentsschemasorganizationprivateread) |  |
| Pagination | [#/components/schemas/Pagination](#componentsschemaspagination) |  |
| PaginationResponse | [#/components/schemas/PaginationResponse](#componentsschemaspaginationresponse) |  |
| PaymentMethod | [#/components/schemas/PaymentMethod](#componentsschemaspaymentmethod) |  |
| PersonalAccessToken | [#/components/schemas/PersonalAccessToken](#componentsschemaspersonalaccesstoken) |  |
| Platforms | [#/components/schemas/Platforms](#componentsschemasplatforms) | An enumeration. |
| Pledge | [#/components/schemas/Pledge](#componentsschemaspledge) |  |
| PledgePledgesSummary | [#/components/schemas/PledgePledgesSummary](#componentsschemaspledgepledgessummary) |  |
| PledgeRewardTransfer | [#/components/schemas/PledgeRewardTransfer](#componentsschemaspledgerewardtransfer) |  |
| PledgeState | [#/components/schemas/PledgeState](#componentsschemaspledgestate) | An enumeration. |
| PledgeStripePaymentIntentCreate | [#/components/schemas/PledgeStripePaymentIntentCreate](#componentsschemaspledgestripepaymentintentcreate) |  |
| PledgeStripePaymentIntentMutationResponse | [#/components/schemas/PledgeStripePaymentIntentMutationResponse](#componentsschemaspledgestripepaymentintentmutationresponse) |  |
| PledgeStripePaymentIntentUpdate | [#/components/schemas/PledgeStripePaymentIntentUpdate](#componentsschemaspledgestripepaymentintentupdate) |  |
| PledgeType | [#/components/schemas/PledgeType](#componentsschemaspledgetype) | An enumeration. |
| Pledger | [#/components/schemas/Pledger](#componentsschemaspledger) |  |
| PledgerPledgePendingNotification | [#/components/schemas/PledgerPledgePendingNotification](#componentsschemaspledgerpledgependingnotification) |  |
| PledgesSummary | [#/components/schemas/PledgesSummary](#componentsschemaspledgessummary) |  |
| PledgesTypeSummaries | [#/components/schemas/PledgesTypeSummaries](#componentsschemaspledgestypesummaries) |  |
| PostIssueComment | [#/components/schemas/PostIssueComment](#componentsschemaspostissuecomment) |  |
| PullRequest | [#/components/schemas/PullRequest](#componentsschemaspullrequest) |  |
| PullRequestReference | [#/components/schemas/PullRequestReference](#componentsschemaspullrequestreference) |  |
| Reactions | [#/components/schemas/Reactions](#componentsschemasreactions) |  |
| Relationship | [#/components/schemas/Relationship](#componentsschemasrelationship) |  |
| RelationshipData | [#/components/schemas/RelationshipData](#componentsschemasrelationshipdata) |  |
| Repository | [#/components/schemas/Repository](#componentsschemasrepository) |  |
| RepositoryBadgeSettingsRead | [#/components/schemas/RepositoryBadgeSettingsRead](#componentsschemasrepositorybadgesettingsread) |  |
| RepositoryBadgeSettingsUpdate | [#/components/schemas/RepositoryBadgeSettingsUpdate](#componentsschemasrepositorybadgesettingsupdate) |  |
| RepositoryLegacyRead | [#/components/schemas/RepositoryLegacyRead](#componentsschemasrepositorylegacyread) |  |
| Reward | [#/components/schemas/Reward](#componentsschemasreward) |  |
| RewardPaidNotification | [#/components/schemas/RewardPaidNotification](#componentsschemasrewardpaidnotification) |  |
| RewardState | [#/components/schemas/RewardState](#componentsschemasrewardstate) | An enumeration. |
| RewardsSummary | [#/components/schemas/RewardsSummary](#componentsschemasrewardssummary) |  |
| RewardsSummaryReceiver | [#/components/schemas/RewardsSummaryReceiver](#componentsschemasrewardssummaryreceiver) |  |
| SummaryPledge | [#/components/schemas/SummaryPledge](#componentsschemassummarypledge) |  |
| UpdateIssue | [#/components/schemas/UpdateIssue](#componentsschemasupdateissue) |  |
| User | [#/components/schemas/User](#componentsschemasuser) |  |
| UserRead | [#/components/schemas/UserRead](#componentsschemasuserread) |  |
| UserSignupType | [#/components/schemas/UserSignupType](#componentsschemasusersignuptype) | An enumeration. |
| UserStripePortalSession | [#/components/schemas/UserStripePortalSession](#componentsschemasuserstripeportalsession) |  |
| UserUpdateSettings | [#/components/schemas/UserUpdateSettings](#componentsschemasuserupdatesettings) |  |
| ValidationError | [#/components/schemas/ValidationError](#componentsschemasvalidationerror) |  |
| Visibility | [#/components/schemas/Visibility](#componentsschemasvisibility) | An enumeration. |
| polar__integrations__github__endpoints__WebhookResponse | [#/components/schemas/polar__integrations__github__endpoints__WebhookResponse](#componentsschemaspolar__integrations__github__endpoints__webhookresponse) |  |
| polar__integrations__stripe__endpoints__WebhookResponse | [#/components/schemas/polar__integrations__stripe__endpoints__WebhookResponse](#componentsschemaspolar__integrations__stripe__endpoints__webhookresponse) |  |
| HTTPBearer | [#/components/securitySchemes/HTTPBearer](#componentssecurityschemeshttpbearer) | You can generate a **Personal Access Token** from your [settings](https://polar.sh/settings). |

## Path Details

***

### [GET]/healthz

- Summary  
Healthz

- Security  
HTTPBearer  

#### Responses

- 200 Successful Response

`application/json`

```ts
{
}
```

***

### [GET]/readyz

- Summary  
Readyz

- Security  
HTTPBearer  

#### Responses

- 200 Successful Response

`application/json`

```ts
{
}
```

***

### [GET]/api/v1/users/me

- Summary  
Get Authenticated

- Security  
HTTPBearer  

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  created_at: string
  modified_at?: string
  username: string
  email: string
  avatar_url?: string
  profile: {
  }
  id: string
  accepted_terms_of_service: boolean
  email_newsletters_and_changelogs: boolean
  email_promotions_and_events: boolean
  oauth_accounts: {
    created_at: string
    modified_at?: string
    // An enumeration.
    platform: enum[github]
    account_id: string
    account_email: string
  }[]
}
```

***

### [PUT]/api/v1/users/me

- Summary  
Update Preferences

- Security  
HTTPBearer  

#### RequestBody

- application/json

```ts
{
  email_newsletters_and_changelogs?: boolean
  email_promotions_and_events?: boolean
}
```

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  created_at: string
  modified_at?: string
  username: string
  email: string
  avatar_url?: string
  profile: {
  }
  id: string
  accepted_terms_of_service: boolean
  email_newsletters_and_changelogs: boolean
  email_promotions_and_events: boolean
  oauth_accounts: {
    created_at: string
    modified_at?: string
    // An enumeration.
    platform: enum[github]
    account_id: string
    account_email: string
  }[]
}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [POST]/api/v1/users/me/token

- Summary  
Create Token

- Security  
HTTPBearer  

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  success: boolean
  expires_at: string
  token?: string
  goto_url?: string
}
```

***

### [GET]/api/v1/users/logout

- Summary  
Logout

- Security  
HTTPBearer  

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  success: boolean
}
```

***

### [POST]/api/v1/users/me/stripe_customer_portal

- Summary  
Create Stripe Customer Portal

- Security  
HTTPBearer  

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  url: string
}
```

***

### [GET]/api/v1/integrations/github/authorize

- Summary  
Github Authorize

- Security  
HTTPBearer  

#### Parameters(Query)

```ts
payment_intent_id?: string
```

```ts
goto_url?: string
```

```ts
// An enumeration.
user_signup_type?: enum[maintainer, backer]
```

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  authorization_url: string
}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [GET]/api/v1/integrations/github/callback

- Summary  
Github Callback

- Security  
HTTPBearer  

#### Parameters(Query)

```ts
code?: string
```

```ts
code_verifier?: string
```

```ts
state?: string
```

```ts
error?: string
```

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  success: boolean
  expires_at: string
  token?: string
  goto_url?: string
}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [GET]/api/v1/integrations/github/{org}/{repo}/issues/{number}/badges/{badge_type}

- Summary  
Get Badge Settings

- Security  
HTTPBearer  

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  badge_type: enum[pledge]
  amount: integer
  funding: {
    funding_goal: {
      // Three letter currency code (eg: USD)
      currency: string
      // Amount in the currencys smallest unit (cents if currency is USD)
      amount: integer
    }
    // Sum of pledges to this isuse (including currently open pledges and pledges that have been paid out). Always in USD.
    pledges_sum?: #/components/schemas/CurrencyAmount
  }
}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [POST]/api/v1/integrations/github/lookup_user

- Summary  
Lookup User

- Security  
HTTPBearer  

#### RequestBody

- application/json

```ts
{
  username: string
}
```

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  username: string
  avatar_url: string
}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [POST]/api/v1/integrations/github/installations

- Summary  
Install

- Security  
HTTPBearer  

#### RequestBody

- application/json

```ts
{
  platform: enum[github]
  external_id: integer
}
```

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  pledge_badge_show_amount?: boolean //default: true
  billing_email?: string
  // An enumeration.
  platform: enum[github]
  name: string
  avatar_url: string
  external_id: integer
  is_personal: boolean
  installation_id?: integer
  installation_created_at?: string
  installation_updated_at?: string
  installation_suspended_at?: string
  onboarded_at?: string
  pledge_minimum_amount: integer
  default_badge_custom_content?: string
  id: string
  created_at: string
  modified_at?: string
  repositories: {
    id: string
    platform:#/components/schemas/Platforms
    // An enumeration.
    visibility: enum[public, private]
    name: string
    description?: string
    stars?: integer
    license?: string
    homepage?: string
  }[]
}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [POST]/api/v1/integrations/github/webhook

- Summary  
Webhook

- Security  
HTTPBearer  

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  success: boolean
  message?: string
  job_id?: string
}
```

***

### [GET]/api/v1/integrations/stripe/return

- Summary  
Stripe Connect Return

- Security  
HTTPBearer  

#### Parameters(Query)

```ts
stripe_id: string
```

#### Responses

- 200 Successful Response

`application/json`

```ts
{}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [GET]/api/v1/integrations/stripe/refresh

- Summary  
Stripe Connect Refresh

- Security  
HTTPBearer  

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  success: boolean
  message?: string
  job_id?: string
}
```

***

### [POST]/api/v1/integrations/stripe/webhook

- Summary  
Webhook

- Security  
HTTPBearer  

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  success: boolean
  message?: string
  job_id?: string
}
```

***

### [GET]/api/v1/backoffice/pledges

- Summary  
Pledges

- Security  
HTTPBearer  

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  // Pledge ID
  id: string
  // When the pledge was created
  created_at: string
  // Amount pledged towards the issue
  amount: #/components/schemas/CurrencyAmount
  // Current state of the pledge
  state: #/components/schemas/PledgeState
  // Type of pledge
  type: #/components/schemas/PledgeType
  // If and when the pledge was refunded to the pledger
  refunded_at?: string
  // When the payout is scheduled to be made to the maintainers behind the issue. Disputes must be made before this date.
  scheduled_payout_at?: string
  // The issue that the pledge was made towards
  issue: #/components/schemas/Issue
  // The user or organization that made this pledge
  pledger?: #/components/schemas/Pledger
  // URL of invoice for this pledge
  hosted_invoice_url?: string
  // If the currently authenticated subject can perform admin actions on behalf of the maker of the peldge
  authed_can_admin_sender?: boolean
  // If the currently authenticated subject can perform admin actions on behalf of the receiver of the peldge
  authed_can_admin_received?: boolean
  payment_id?: string
  dispute_reason?: string
  disputed_by_user_id?: string
  disputed_at?: string
  pledger_email?: string
}[]
```

***

### [GET]/api/v1/backoffice/rewards/by_issue

- Summary  
Rewards

- Security  
HTTPBearer  

#### Parameters(Query)

```ts
issue_id?: string
```

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  items: {
    // The pledge that the reward was split from
    pledge: #/components/schemas/Pledge
    // The user that received the reward (if any)
    user?: #/components/schemas/User
    // The organization that received the reward (if any)
    organization?: #/components/schemas/Organization
    amount: {
      // Three letter currency code (eg: USD)
      currency: string
      // Amount in the currencys smallest unit (cents if currency is USD)
      amount: integer
    }
    // An enumeration.
    state: enum[pending, paid]
    // If and when the reward was paid out.
    paid_at?: string
    transfer_id?: string
    issue_reward_id: string
    pledge_payment_id?: string
    pledger_email?: string
  }[]
  pagination: {
    total_count: integer
    max_page: integer
  }
}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [GET]/api/v1/backoffice/rewards/pending

- Summary  
Rewards Pending

- Security  
HTTPBearer  

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  items: {
    // The pledge that the reward was split from
    pledge: #/components/schemas/Pledge
    // The user that received the reward (if any)
    user?: #/components/schemas/User
    // The organization that received the reward (if any)
    organization?: #/components/schemas/Organization
    amount: {
      // Three letter currency code (eg: USD)
      currency: string
      // Amount in the currencys smallest unit (cents if currency is USD)
      amount: integer
    }
    // An enumeration.
    state: enum[pending, paid]
    // If and when the reward was paid out.
    paid_at?: string
    transfer_id?: string
    issue_reward_id: string
    pledge_payment_id?: string
    pledger_email?: string
  }[]
  pagination: {
    total_count: integer
    max_page: integer
  }
}
```

***

### [GET]/api/v1/backoffice/issue/{id}

- Summary  
Issue

- Security  
HTTPBearer  

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  id: string
  // Issue platform (currently always GitHub)
  platform: #/components/schemas/Platforms
  // GitHub #number
  number: integer
  // GitHub issue title
  title: string
  // GitHub issue body
  body?: string
  // Number of GitHub comments made on the issue
  comments?: integer
  labels: {
    name: string
    color: string
  }[]
  // GitHub author
  author?: #/components/schemas/Author
  assignees: {
    id: integer
    login: string
    html_url: string
    avatar_url: string
  }[]
  // GitHub reactions
  reactions?: #/components/schemas/Reactions
  state: enum[OPEN, CLOSED]
  issue_closed_at?: string
  issue_modified_at?: string
  issue_created_at: string
  // If a maintainer needs to mark this issue as solved
  needs_confirmation_solved: boolean
  // If this issue has been marked as confirmed solved through Polar
  confirmed_solved_at?: string
  funding: {
    funding_goal: {
      // Three letter currency code (eg: USD)
      currency: string
      // Amount in the currencys smallest unit (cents if currency is USD)
      amount: integer
    }
    // Sum of pledges to this isuse (including currently open pledges and pledges that have been paid out). Always in USD.
    pledges_sum?: #/components/schemas/CurrencyAmount
  }
  // The repository that the issue is in
  repository: #/components/schemas/Repository
  // Share of rewrads that will be rewarded to contributors of this issue. A number between 0 and 100 (inclusive).
  upfront_split_to_contributors?: integer
  // If this issue currently has the Polar badge SVG embedded
  pledge_badge_currently_embedded: boolean
  // Optional custom badge SVG promotional content
  badge_custom_content?: string
}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [POST]/api/v1/backoffice/pledges/approve

- Summary  
Pledge Reward Transfer

- Security  
HTTPBearer  

#### RequestBody

- application/json

```ts
{
  pledge_id: string
  issue_reward_id: string
}
```

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  // The pledge that the reward was split from
  pledge: #/components/schemas/Pledge
  // The user that received the reward (if any)
  user?: #/components/schemas/User
  // The organization that received the reward (if any)
  organization?: #/components/schemas/Organization
  amount: {
    // Three letter currency code (eg: USD)
    currency: string
    // Amount in the currencys smallest unit (cents if currency is USD)
    amount: integer
  }
  // An enumeration.
  state: enum[pending, paid]
  // If and when the reward was paid out.
  paid_at?: string
  transfer_id?: string
  issue_reward_id: string
  pledge_payment_id?: string
  pledger_email?: string
}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [POST]/api/v1/backoffice/pledges/create_invoice/{pledge_id}

- Summary  
Pledge Create Invoice

- Security  
HTTPBearer  

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  // Pledge ID
  id: string
  // When the pledge was created
  created_at: string
  // Amount pledged towards the issue
  amount: #/components/schemas/CurrencyAmount
  // Current state of the pledge
  state: #/components/schemas/PledgeState
  // Type of pledge
  type: #/components/schemas/PledgeType
  // If and when the pledge was refunded to the pledger
  refunded_at?: string
  // When the payout is scheduled to be made to the maintainers behind the issue. Disputes must be made before this date.
  scheduled_payout_at?: string
  // The issue that the pledge was made towards
  issue: #/components/schemas/Issue
  // The user or organization that made this pledge
  pledger?: #/components/schemas/Pledger
  // URL of invoice for this pledge
  hosted_invoice_url?: string
  // If the currently authenticated subject can perform admin actions on behalf of the maker of the peldge
  authed_can_admin_sender?: boolean
  // If the currently authenticated subject can perform admin actions on behalf of the receiver of the peldge
  authed_can_admin_received?: boolean
  payment_id?: string
  dispute_reason?: string
  disputed_by_user_id?: string
  disputed_at?: string
  pledger_email?: string
}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [POST]/api/v1/backoffice/pledges/mark_disputed/{pledge_id}

- Summary  
Pledge Mark Disputed

- Security  
HTTPBearer  

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  // Pledge ID
  id: string
  // When the pledge was created
  created_at: string
  // Amount pledged towards the issue
  amount: #/components/schemas/CurrencyAmount
  // Current state of the pledge
  state: #/components/schemas/PledgeState
  // Type of pledge
  type: #/components/schemas/PledgeType
  // If and when the pledge was refunded to the pledger
  refunded_at?: string
  // When the payout is scheduled to be made to the maintainers behind the issue. Disputes must be made before this date.
  scheduled_payout_at?: string
  // The issue that the pledge was made towards
  issue: #/components/schemas/Issue
  // The user or organization that made this pledge
  pledger?: #/components/schemas/Pledger
  // URL of invoice for this pledge
  hosted_invoice_url?: string
  // If the currently authenticated subject can perform admin actions on behalf of the maker of the peldge
  authed_can_admin_sender?: boolean
  // If the currently authenticated subject can perform admin actions on behalf of the receiver of the peldge
  authed_can_admin_received?: boolean
  payment_id?: string
  dispute_reason?: string
  disputed_by_user_id?: string
  disputed_at?: string
  pledger_email?: string
}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [POST]/api/v1/backoffice/organization/sync/{name}

- Summary  
Organization Sync

- Security  
HTTPBearer  

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  pledge_badge_show_amount?: boolean //default: true
  billing_email?: string
  // An enumeration.
  platform: enum[github]
  name: string
  avatar_url: string
  external_id: integer
  is_personal: boolean
  installation_id?: integer
  installation_created_at?: string
  installation_updated_at?: string
  installation_suspended_at?: string
  onboarded_at?: string
  pledge_minimum_amount: integer
  default_badge_custom_content?: string
  id: string
  created_at: string
  modified_at?: string
  repositories: {
    id: string
    platform:#/components/schemas/Platforms
    // An enumeration.
    visibility: enum[public, private]
    name: string
    description?: string
    stars?: integer
    license?: string
    homepage?: string
  }[]
}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [POST]/api/v1/backoffice/badge

- Summary  
Manage Badge

- Security  
HTTPBearer  

#### RequestBody

- application/json

```ts
{
  org_slug: string
  repo_slug: string
  issue_number: integer
  action: enum[embed, remove]
}
```

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  org_slug: string
  repo_slug: string
  issue_number: integer
  action: enum[embed, remove]
  success: boolean
}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [GET]/api/v1/dashboard/personal

- Summary  
Get Personal Dashboard

- Security  
HTTPBearer  

#### Parameters(Query)

```ts
issue_list_type?: #/components/schemas/IssueListType
```

```ts
// An enumeration.
status?: enum[backlog, triaged, in_progress, pull_request, closed, building][]
```

```ts
q?: string
```

```ts
// An enumeration.
sort?: enum[newest, recently_updated, least_recently_updated, pledged_amount_desc, relevance, dependencies_default, issues_default, most_engagement, most_positive_reactions, funding_goal_desc_and_most_positive_reactions]
```

```ts
only_pledged?: boolean
```

```ts
only_badged?: boolean
```

```ts
page?: integer //default: 1
```

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  data: {
    type: string
    id: Partial(string) & Partial(string)
    attributes: {
      id: string
      // Issue platform (currently always GitHub)
      platform: #/components/schemas/Platforms
      // GitHub #number
      number: integer
      // GitHub issue title
      title: string
      // GitHub issue body
      body?: string
      // Number of GitHub comments made on the issue
      comments?: integer
      labels: {
        name: string
        color: string
      }[]
      // GitHub author
      author?: #/components/schemas/Author
      assignees: {
        id: integer
        login: string
        html_url: string
        avatar_url: string
      }[]
      // GitHub reactions
      reactions?: #/components/schemas/Reactions
      state: enum[OPEN, CLOSED]
      issue_closed_at?: string
      issue_modified_at?: string
      issue_created_at: string
      // If a maintainer needs to mark this issue as solved
      needs_confirmation_solved: boolean
      // If this issue has been marked as confirmed solved through Polar
      confirmed_solved_at?: string
      funding: {
        funding_goal: {
          // Three letter currency code (eg: USD)
          currency: string
          // Amount in the currencys smallest unit (cents if currency is USD)
          amount: integer
        }
        // Sum of pledges to this isuse (including currently open pledges and pledges that have been paid out). Always in USD.
        pledges_sum?: #/components/schemas/CurrencyAmount
      }
      // The repository that the issue is in
      repository: #/components/schemas/Repository
      // Share of rewrads that will be rewarded to contributors of this issue. A number between 0 and 100 (inclusive).
      upfront_split_to_contributors?: integer
      // If this issue currently has the Polar badge SVG embedded
      pledge_badge_currently_embedded: boolean
      // Optional custom badge SVG promotional content
      badge_custom_content?: string
    }
    relationships: {
    }
  }[]
  included: {
    type: string
    id: Partial(string) & Partial(string)
    relationships: {
    }
  }[]
  pagination: {
    total_count: integer
    page: integer
    next_page?: integer
  }
}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [GET]/api/v1/dashboard/{platform}/{org_name}

- Summary  
Get Dashboard

- Security  
HTTPBearer  

#### Parameters(Query)

```ts
repo_name?: string
```

```ts
issue_list_type?: #/components/schemas/IssueListType
```

```ts
// An enumeration.
status?: enum[backlog, triaged, in_progress, pull_request, closed, building][]
```

```ts
q?: string
```

```ts
// An enumeration.
sort?: enum[newest, recently_updated, least_recently_updated, pledged_amount_desc, relevance, dependencies_default, issues_default, most_engagement, most_positive_reactions, funding_goal_desc_and_most_positive_reactions]
```

```ts
only_pledged?: boolean
```

```ts
only_badged?: boolean
```

```ts
page?: integer //default: 1
```

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  data: {
    type: string
    id: Partial(string) & Partial(string)
    attributes: {
      id: string
      // Issue platform (currently always GitHub)
      platform: #/components/schemas/Platforms
      // GitHub #number
      number: integer
      // GitHub issue title
      title: string
      // GitHub issue body
      body?: string
      // Number of GitHub comments made on the issue
      comments?: integer
      labels: {
        name: string
        color: string
      }[]
      // GitHub author
      author?: #/components/schemas/Author
      assignees: {
        id: integer
        login: string
        html_url: string
        avatar_url: string
      }[]
      // GitHub reactions
      reactions?: #/components/schemas/Reactions
      state: enum[OPEN, CLOSED]
      issue_closed_at?: string
      issue_modified_at?: string
      issue_created_at: string
      // If a maintainer needs to mark this issue as solved
      needs_confirmation_solved: boolean
      // If this issue has been marked as confirmed solved through Polar
      confirmed_solved_at?: string
      funding: {
        funding_goal: {
          // Three letter currency code (eg: USD)
          currency: string
          // Amount in the currencys smallest unit (cents if currency is USD)
          amount: integer
        }
        // Sum of pledges to this isuse (including currently open pledges and pledges that have been paid out). Always in USD.
        pledges_sum?: #/components/schemas/CurrencyAmount
      }
      // The repository that the issue is in
      repository: #/components/schemas/Repository
      // Share of rewrads that will be rewarded to contributors of this issue. A number between 0 and 100 (inclusive).
      upfront_split_to_contributors?: integer
      // If this issue currently has the Polar badge SVG embedded
      pledge_badge_currently_embedded: boolean
      // Optional custom badge SVG promotional content
      badge_custom_content?: string
    }
    relationships: {
    }
  }[]
  included: {
    type: string
    id: Partial(string) & Partial(string)
    relationships: {
    }
  }[]
  pagination: {
    total_count: integer
    page: integer
    next_page?: integer
  }
}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [GET]/api/v1/dashboard/dummy_do_not_use

- Summary  
Dummy Do Not Use

- Security  
HTTPBearer  

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  pay_upfront: {
    total: {
      // Three letter currency code (eg: USD)
      currency: string
      // Amount in the currencys smallest unit (cents if currency is USD)
      amount: integer
    }
    pledgers: {
      name: string
      github_username?: string
      avatar_url?: string
    }[]
  }
  pay_on_completion:#/components/schemas/PledgesSummary
  pay_directly:#/components/schemas/PledgesSummary
}
```

***

### [GET]/api/v1/extension/{platform}/{org_name}/{repo_name}/issues

- Summary  
List Issues For Extension

- Security  
HTTPBearer  

#### Parameters(Query)

```ts
numbers: string
```

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  number: integer
  pledges: {
    // Pledge ID
    id: string
    // When the pledge was created
    created_at: string
    // Amount pledged towards the issue
    amount: #/components/schemas/CurrencyAmount
    // Current state of the pledge
    state: #/components/schemas/PledgeState
    // Type of pledge
    type: #/components/schemas/PledgeType
    // If and when the pledge was refunded to the pledger
    refunded_at?: string
    // When the payout is scheduled to be made to the maintainers behind the issue. Disputes must be made before this date.
    scheduled_payout_at?: string
    // The issue that the pledge was made towards
    issue: #/components/schemas/Issue
    // The user or organization that made this pledge
    pledger?: #/components/schemas/Pledger
    // URL of invoice for this pledge
    hosted_invoice_url?: string
    // If the currently authenticated subject can perform admin actions on behalf of the maker of the peldge
    authed_can_admin_sender?: boolean
    // If the currently authenticated subject can perform admin actions on behalf of the receiver of the peldge
    authed_can_admin_received?: boolean
  }[]
  references: {
    id: string
    // An enumeration.
    type: enum[pull_request, external_github_pull_request, external_github_commit]
    payload: Partial(#/components/schemas/PullRequestReference) & Partial(#/components/schemas/ExternalGitHubPullRequestReference) & Partial(#/components/schemas/ExternalGitHubCommitReference)
    pullRequestReference: {
      id: string
      title: string
      author_login: string
      author_avatar: string
      number: integer
      additions: integer
      deletions: integer
      state: string
      created_at: string
      merged_at?: string
      closed_at?: string
      is_draft: boolean
    }
    externalGitHubPullRequestReference: {
      title: string
      author_login: string
      author_avatar: string
      number: integer
      organization_name: string
      repository_name: string
      state: string
    }
    externalGitHubCommitReference: {
      author_login: string
      author_avatar: string
      sha: string
      organization_name: string
      repository_name: string
      branch_name?: string
      message?: string
    }
  }[]
  issue: {
    id: string
    // Issue platform (currently always GitHub)
    platform: #/components/schemas/Platforms
    // GitHub #number
    number: integer
    // GitHub issue title
    title: string
    // GitHub issue body
    body?: string
    // Number of GitHub comments made on the issue
    comments?: integer
    labels: {
      name: string
      color: string
    }[]
    // GitHub author
    author?: #/components/schemas/Author
    assignees: {
      id: integer
      login: string
      html_url: string
      avatar_url: string
    }[]
    // GitHub reactions
    reactions?: #/components/schemas/Reactions
    state: enum[OPEN, CLOSED]
    issue_closed_at?: string
    issue_modified_at?: string
    issue_created_at: string
    // If a maintainer needs to mark this issue as solved
    needs_confirmation_solved: boolean
    // If this issue has been marked as confirmed solved through Polar
    confirmed_solved_at?: string
    funding: {
      funding_goal: {
        // Three letter currency code (eg: USD)
        currency: string
        // Amount in the currencys smallest unit (cents if currency is USD)
        amount: integer
      }
      // Sum of pledges to this isuse (including currently open pledges and pledges that have been paid out). Always in USD.
      pledges_sum?: #/components/schemas/CurrencyAmount
    }
    // The repository that the issue is in
    repository: #/components/schemas/Repository
    // Share of rewrads that will be rewarded to contributors of this issue. A number between 0 and 100 (inclusive).
    upfront_split_to_contributors?: integer
    // If this issue currently has the Polar badge SVG embedded
    pledge_badge_currently_embedded: boolean
    // Optional custom badge SVG promotional content
    badge_custom_content?: string
  }
}[]
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [GET]/api/v1/funding/search

- Summary  
Search

- Security  
HTTPBearer  

#### Parameters(Query)

```ts
// Filter by organization name.
organization_name: string
```

```ts
// Filter by repository name.
repository_name?: string
```

```ts
badged?: boolean
```

```ts
closed?: boolean
```

```ts
// An enumeration.
sorting?: enum[oldest, newest, most_funded, most_engagement][]
```

```ts
// An enumeration.
platform: enum[github]
```

```ts
// Page number, defaults to 1.
page?: integer //default: 1
```

```ts
// Size of a page, defaults to 10. Maximum is 100
limit?: integer //default: 10
```

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  items: {
    issue: {
      id: string
      // Issue platform (currently always GitHub)
      platform: #/components/schemas/Platforms
      // GitHub #number
      number: integer
      // GitHub issue title
      title: string
      // GitHub issue body
      body?: string
      // Number of GitHub comments made on the issue
      comments?: integer
      labels: {
        name: string
        color: string
      }[]
      // GitHub author
      author?: #/components/schemas/Author
      assignees: {
        id: integer
        login: string
        html_url: string
        avatar_url: string
      }[]
      // GitHub reactions
      reactions?: #/components/schemas/Reactions
      state: enum[OPEN, CLOSED]
      issue_closed_at?: string
      issue_modified_at?: string
      issue_created_at: string
      // If a maintainer needs to mark this issue as solved
      needs_confirmation_solved: boolean
      // If this issue has been marked as confirmed solved through Polar
      confirmed_solved_at?: string
      funding: {
        funding_goal: {
          // Three letter currency code (eg: USD)
          currency: string
          // Amount in the currencys smallest unit (cents if currency is USD)
          amount: integer
        }
        // Sum of pledges to this isuse (including currently open pledges and pledges that have been paid out). Always in USD.
        pledges_sum?: #/components/schemas/CurrencyAmount
      }
      // The repository that the issue is in
      repository: #/components/schemas/Repository
      // Share of rewrads that will be rewarded to contributors of this issue. A number between 0 and 100 (inclusive).
      upfront_split_to_contributors?: integer
      // If this issue currently has the Polar badge SVG embedded
      pledge_badge_currently_embedded: boolean
      // Optional custom badge SVG promotional content
      badge_custom_content?: string
    }
    funding_goal:#/components/schemas/CurrencyAmount
    total:#/components/schemas/CurrencyAmount
    pledges_summaries: {
      pay_upfront: {
        total:#/components/schemas/CurrencyAmount
        pledgers: {
          name: string
          github_username?: string
          avatar_url?: string
        }[]
      }
      pay_on_completion:#/components/schemas/PledgesSummary
      pay_directly:#/components/schemas/PledgesSummary
    }
  }[]
  pagination: {
    total_count: integer
    max_page: integer
  }
}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [GET]/api/v1/funding/lookup

- Summary  
Lookup

- Security  
HTTPBearer  

#### Parameters(Query)

```ts
issue_id: string
```

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  issue: {
    id: string
    // Issue platform (currently always GitHub)
    platform: #/components/schemas/Platforms
    // GitHub #number
    number: integer
    // GitHub issue title
    title: string
    // GitHub issue body
    body?: string
    // Number of GitHub comments made on the issue
    comments?: integer
    labels: {
      name: string
      color: string
    }[]
    // GitHub author
    author?: #/components/schemas/Author
    assignees: {
      id: integer
      login: string
      html_url: string
      avatar_url: string
    }[]
    // GitHub reactions
    reactions?: #/components/schemas/Reactions
    state: enum[OPEN, CLOSED]
    issue_closed_at?: string
    issue_modified_at?: string
    issue_created_at: string
    // If a maintainer needs to mark this issue as solved
    needs_confirmation_solved: boolean
    // If this issue has been marked as confirmed solved through Polar
    confirmed_solved_at?: string
    funding: {
      funding_goal: {
        // Three letter currency code (eg: USD)
        currency: string
        // Amount in the currencys smallest unit (cents if currency is USD)
        amount: integer
      }
      // Sum of pledges to this isuse (including currently open pledges and pledges that have been paid out). Always in USD.
      pledges_sum?: #/components/schemas/CurrencyAmount
    }
    // The repository that the issue is in
    repository: #/components/schemas/Repository
    // Share of rewrads that will be rewarded to contributors of this issue. A number between 0 and 100 (inclusive).
    upfront_split_to_contributors?: integer
    // If this issue currently has the Polar badge SVG embedded
    pledge_badge_currently_embedded: boolean
    // Optional custom badge SVG promotional content
    badge_custom_content?: string
  }
  funding_goal:#/components/schemas/CurrencyAmount
  total:#/components/schemas/CurrencyAmount
  pledges_summaries: {
    pay_upfront: {
      total:#/components/schemas/CurrencyAmount
      pledgers: {
        name: string
        github_username?: string
        avatar_url?: string
      }[]
    }
    pay_on_completion:#/components/schemas/PledgesSummary
    pay_directly:#/components/schemas/PledgesSummary
  }
}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [POST]/api/v1/magic_link/request

- Summary  
Request Magic Link

- Security  
HTTPBearer  

#### RequestBody

- application/json

```ts
{
  email: string
}
```

#### Responses

- 202 Successful Response

`application/json`

```ts
{}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [POST]/api/v1/magic_link/authenticate

- Summary  
Authenticate Magic Link

- Security  
HTTPBearer  

#### Parameters(Query)

```ts
token: string
```

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  success: boolean
  expires_at: string
  token?: string
  goto_url?: string
}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [GET]/api/v1/notifications

- Summary  
Get

- Security  
HTTPBearer  

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  notifications: {
    id: string
    // An enumeration.
    type: enum[MaintainerPledgePaidNotification, MaintainerPledgeConfirmationPendingNotification, MaintainerPledgePendingNotification, MaintainerPledgeCreatedNotification, PledgerPledgePendingNotification, RewardPaidNotification, MaintainerPledgedIssueConfirmationPendingNotification, MaintainerPledgedIssuePendingNotification]
    created_at: string
    payload: Partial(#/components/schemas/MaintainerPledgePaidNotification) & Partial(#/components/schemas/MaintainerPledgeConfirmationPendingNotification) & Partial(#/components/schemas/MaintainerPledgePendingNotification) & Partial(#/components/schemas/MaintainerPledgeCreatedNotification) & Partial(#/components/schemas/PledgerPledgePendingNotification) & Partial(#/components/schemas/RewardPaidNotification) & Partial(#/components/schemas/MaintainerPledgedIssueConfirmationPendingNotification) & Partial(#/components/schemas/MaintainerPledgedIssuePendingNotification)
    maintainerPledgePaid: {
      paid_out_amount: string
      issue_url: string
      issue_title: string
      issue_org_name: string
      issue_repo_name: string
      issue_number: integer
      pledge_id?: string
    }
    maintainerPledgeConfirmationPending: {
      pledger_name: string
      pledge_amount: string
      issue_url: string
      issue_title: string
      issue_org_name: string
      issue_repo_name: string
      issue_number: integer
      maintainer_has_stripe_account: boolean
      pledge_id?: string
    }
    maintainerPledgePending: {
      pledger_name: string
      pledge_amount: string
      issue_url: string
      issue_title: string
      issue_org_name: string
      issue_repo_name: string
      issue_number: integer
      maintainer_has_stripe_account: boolean
      pledge_id?: string
    }
    maintainerPledgeCreated: {
      pledger_name: string
      pledge_amount: string
      issue_url: string
      issue_title: string
      issue_org_name: string
      issue_repo_name: string
      issue_number: integer
      maintainer_has_stripe_account: boolean
      pledge_id?: string
    }
    pledgerPledgePending: {
      pledge_amount: string
      issue_url: string
      issue_title: string
      issue_number: integer
      issue_org_name: string
      issue_repo_name: string
      pledge_date: string
      pledge_id?: string
      // An enumeration.
      pledge_type?: enum[pay_upfront, pay_on_completion, pay_directly]
    }
    rewardPaid: {
      paid_out_amount: string
      issue_url: string
      issue_title: string
      issue_org_name: string
      issue_repo_name: string
      issue_number: integer
      issue_id: string
      pledge_id: string
    }
    maintainerPledgedIssueConfirmationPending: {
      pledge_amount_sum: string
      issue_id: string
      issue_url: string
      issue_title: string
      issue_org_name: string
      issue_repo_name: string
      issue_number: integer
      maintainer_has_account: boolean
    }
    maintainerPledgedIssuePending: {
      pledge_amount_sum: string
      issue_id: string
      issue_url: string
      issue_title: string
      issue_org_name: string
      issue_repo_name: string
      issue_number: integer
      maintainer_has_account: boolean
    }
  }[]
  last_read_notification_id?: string
}
```

***

### [POST]/api/v1/notifications/read

- Summary  
Mark Read

- Security  
HTTPBearer  

#### RequestBody

- application/json

```ts
{
  notification_id: string
}
```

#### Responses

- 200 Successful Response

`application/json`

```ts
{}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [GET]/api/v1/repositories

- Summary  
List repositories (Public API)

- Description  
List repositories in organizations that the authenticated user is a member of. Requires authentication.

- Security  
HTTPBearer  

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  items: {
    id: string
    // An enumeration.
    platform: enum[github]
    // An enumeration.
    visibility: enum[public, private]
    name: string
    description?: string
    stars?: integer
    license?: string
    homepage?: string
    organization: {
      id: string
      platform:#/components/schemas/Platforms
      name: string
      avatar_url: string
      bio?: string
      pretty_name?: string
      company?: string
      blog?: string
      location?: string
      email?: string
      twitter_username?: string
      pledge_minimum_amount: integer
      pledge_badge_show_amount: boolean
    }
  }[]
  pagination: {
    total_count: integer
    max_page: integer
  }
}
```

***

### [GET]/api/v1/repositories/search

- Summary  
Search repositories (Public API)

- Description  
Search repositories.

- Security  
HTTPBearer  

#### Parameters(Query)

```ts
// An enumeration.
platform: enum[github]
```

```ts
organization_name: string
```

```ts
repository_name?: string
```

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  items: {
    id: string
    // An enumeration.
    platform: enum[github]
    // An enumeration.
    visibility: enum[public, private]
    name: string
    description?: string
    stars?: integer
    license?: string
    homepage?: string
    organization: {
      id: string
      platform:#/components/schemas/Platforms
      name: string
      avatar_url: string
      bio?: string
      pretty_name?: string
      company?: string
      blog?: string
      location?: string
      email?: string
      twitter_username?: string
      pledge_minimum_amount: integer
      pledge_badge_show_amount: boolean
    }
  }[]
  pagination: {
    total_count: integer
    max_page: integer
  }
}
```

- 404 Not Found

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [GET]/api/v1/repositories/lookup

- Summary  
Lookup repositories (Public API)

- Description  
Lookup repositories. Like search but returns at only one repository.

- Security  
HTTPBearer  

#### Parameters(Query)

```ts
// An enumeration.
platform: enum[github]
```

```ts
organization_name: string
```

```ts
repository_name: string
```

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  id: string
  // An enumeration.
  platform: enum[github]
  // An enumeration.
  visibility: enum[public, private]
  name: string
  description?: string
  stars?: integer
  license?: string
  homepage?: string
  organization: {
    id: string
    platform:#/components/schemas/Platforms
    name: string
    avatar_url: string
    bio?: string
    pretty_name?: string
    company?: string
    blog?: string
    location?: string
    email?: string
    twitter_username?: string
    pledge_minimum_amount: integer
    pledge_badge_show_amount: boolean
  }
}
```

- 404 Not Found

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [GET]/api/v1/repositories/{id}

- Summary  
Get a repository (Public API)

- Description  
Get a repository

- Security  
HTTPBearer  

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  id: string
  // An enumeration.
  platform: enum[github]
  // An enumeration.
  visibility: enum[public, private]
  name: string
  description?: string
  stars?: integer
  license?: string
  homepage?: string
  organization: {
    id: string
    platform:#/components/schemas/Platforms
    name: string
    avatar_url: string
    bio?: string
    pretty_name?: string
    company?: string
    blog?: string
    location?: string
    email?: string
    twitter_username?: string
    pledge_minimum_amount: integer
    pledge_badge_show_amount: boolean
  }
}
```

- 404 Not Found

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [GET]/api/v1/rewards/search

- Summary  
Search rewards (Public API)

- Description  
Search rewards.

- Security  
HTTPBearer  

#### Parameters(Query)

```ts
// Search rewards for pledges in this organization.
pledges_to_organization?: string
```

```ts
// Search rewards to user.
rewards_to_user?: string
```

```ts
// Search rewards to organization.
rewards_to_org?: string
```

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  items: {
    // The pledge that the reward was split from
    pledge: #/components/schemas/Pledge
    // The user that received the reward (if any)
    user?: #/components/schemas/User
    // The organization that received the reward (if any)
    organization?: #/components/schemas/Organization
    amount: {
      // Three letter currency code (eg: USD)
      currency: string
      // Amount in the currencys smallest unit (cents if currency is USD)
      amount: integer
    }
    // An enumeration.
    state: enum[pending, paid]
    // If and when the reward was paid out.
    paid_at?: string
  }[]
  pagination: {
    total_count: integer
    max_page: integer
  }
}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [GET]/api/v1/rewards/summary

- Summary  
Get rewards summary (Public API)

- Description  
Get summary of rewards for resource.

- Security  
HTTPBearer  

#### Parameters(Query)

```ts
issue_id: string
```

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  receivers: {
    name: string
    avatar_url?: string
  }[]
}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [DELETE]/api/v1/personal_access_tokens/{id}

- Summary  
Delete a personal access tokens (Public API)

- Description  
Delete a personal access tokens. Requires authentication.

- Security  
HTTPBearer  

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  id: string
  created_at: string
  last_used_at?: string
  expires_at: string
  comment: string
}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [GET]/api/v1/personal_access_tokens

- Summary  
List personal access tokens (Public API)

- Description  
List personal access tokens. Requires authentication.

- Security  
HTTPBearer  

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  items: {
    id: string
    created_at: string
    last_used_at?: string
    expires_at: string
    comment: string
  }[]
  pagination: {
    total_count: integer
    max_page: integer
  }
}
```

***

### [POST]/api/v1/personal_access_tokens

- Summary  
Create a new personal access token (Public API)

- Description  
Create a new personal access token. Requires authentication.

- Security  
HTTPBearer  

#### RequestBody

- application/json

```ts
{
  comment: string
}
```

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  id: string
  created_at: string
  last_used_at?: string
  expires_at: string
  comment: string
  token: string
}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [GET]/api/v1/payment_methods

- Summary  
List

- Security  
HTTPBearer  

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  items: {
    stripe_payment_method_id: string
    type: enum[card]
    brand?: string
    last4: string
    exp_month: integer
    exp_year: integer
  }[]
  pagination: {
    total_count: integer
    max_page: integer
  }
}
```

***

### [POST]/api/v1/payment_methods/{id}/detach

- Summary  
Detach

- Security  
HTTPBearer  

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  stripe_payment_method_id: string
  type: enum[card]
  brand?: string
  last4: string
  exp_month: integer
  exp_year: integer
}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [GET]/api/v1/pull_requests/search

- Summary  
Search pull requests (Public API)

- Description  
Search pull requests.

- Security  
HTTPBearer  

#### Parameters(Query)

```ts
// Search pull requests that are mentioning this issue
references_issue_id?: string
```

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  items: {
    id: string
    number: integer
    title: string
    author: {
      id: integer
      login: string
      html_url: string
      avatar_url: string
    }
    additions: integer
    deletions: integer
    is_merged: boolean
    is_closed: boolean
  }[]
  pagination: {
    total_count: integer
    max_page: integer
  }
}
```

- 404 Not Found

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [GET]/api/v1/accounts/search

- Summary  
Search

- Security  
HTTPBearer  

#### Parameters(Query)

```ts
// Search accounts connected to this organization. Either user_id or organization_id must be set.
organization_id?: string
```

```ts
// Search accounts connected to this user. Either user_id or organization_id must be set.
user_id?: string
```

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  items: {
    id: string
    // An enumeration.
    account_type: enum[stripe, open_collective]
    stripe_id?: string
    open_collective_slug?: string
    is_details_submitted?: boolean
    country: string
  }[]
  pagination: {
    total_count: integer
    max_page: integer
  }
}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [GET]/api/v1/accounts/{id}

- Summary  
Get

- Security  
HTTPBearer  

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  id: string
  // An enumeration.
  account_type: enum[stripe, open_collective]
  stripe_id?: string
  open_collective_slug?: string
  is_details_submitted?: boolean
  country: string
}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [POST]/api/v1/accounts/{id}/onboarding_link

- Summary  
Onboarding Link

- Security  
HTTPBearer  

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  url: string
}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [POST]/api/v1/accounts/{id}/dashboard_link

- Summary  
Dashboard Link

- Security  
HTTPBearer  

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  url: string
}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [POST]/api/v1/accounts

- Summary  
Create

- Security  
HTTPBearer  

#### RequestBody

- application/json

```ts
{
  user_id?: string
  organization_id?: string
  // An enumeration.
  account_type: enum[stripe, open_collective]
  open_collective_slug?: string
  // Two letter uppercase country code
  country: string
}
```

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  id: string
  // An enumeration.
  account_type: enum[stripe, open_collective]
  stripe_id?: string
  open_collective_slug?: string
  is_details_submitted?: boolean
  country: string
}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [GET]/api/v1/issues/search

- Summary  
Search issues (Public API)

- Description  
Search issues.

- Security  
HTTPBearer  

#### Parameters(Query)

```ts
// An enumeration.
platform: enum[github]
```

```ts
organization_name: string
```

```ts
repository_name?: string
```

```ts
// Issue sorting method
sort?: #/components/schemas/IssueSortBy
```

```ts
// Set to true to only return issues that have a pledge behind them
have_pledge?: boolean
```

```ts
// Set to true to only return issues that have the Polar badge in the issue description
have_badge?: boolean
```

```ts
// Filter to only return issues connected to this GitHub milestone.
github_milestone_number?: integer
```

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  items: {
    id: string
    // Issue platform (currently always GitHub)
    platform: #/components/schemas/Platforms
    // GitHub #number
    number: integer
    // GitHub issue title
    title: string
    // GitHub issue body
    body?: string
    // Number of GitHub comments made on the issue
    comments?: integer
    labels: {
      name: string
      color: string
    }[]
    // GitHub author
    author?: #/components/schemas/Author
    assignees: {
      id: integer
      login: string
      html_url: string
      avatar_url: string
    }[]
    // GitHub reactions
    reactions?: #/components/schemas/Reactions
    state: enum[OPEN, CLOSED]
    issue_closed_at?: string
    issue_modified_at?: string
    issue_created_at: string
    // If a maintainer needs to mark this issue as solved
    needs_confirmation_solved: boolean
    // If this issue has been marked as confirmed solved through Polar
    confirmed_solved_at?: string
    funding: {
      funding_goal: {
        // Three letter currency code (eg: USD)
        currency: string
        // Amount in the currencys smallest unit (cents if currency is USD)
        amount: integer
      }
      // Sum of pledges to this isuse (including currently open pledges and pledges that have been paid out). Always in USD.
      pledges_sum?: #/components/schemas/CurrencyAmount
    }
    // The repository that the issue is in
    repository: #/components/schemas/Repository
    // Share of rewrads that will be rewarded to contributors of this issue. A number between 0 and 100 (inclusive).
    upfront_split_to_contributors?: integer
    // If this issue currently has the Polar badge SVG embedded
    pledge_badge_currently_embedded: boolean
    // Optional custom badge SVG promotional content
    badge_custom_content?: string
  }[]
  pagination: {
    total_count: integer
    max_page: integer
  }
}
```

- 404 Not Found

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [GET]/api/v1/issues/lookup

- Summary  
Lookup

- Security  
HTTPBearer  

#### Parameters(Query)

```ts
// URL to issue on external source
external_url?: string
```

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  id: string
  // Issue platform (currently always GitHub)
  platform: #/components/schemas/Platforms
  // GitHub #number
  number: integer
  // GitHub issue title
  title: string
  // GitHub issue body
  body?: string
  // Number of GitHub comments made on the issue
  comments?: integer
  labels: {
    name: string
    color: string
  }[]
  // GitHub author
  author?: #/components/schemas/Author
  assignees: {
    id: integer
    login: string
    html_url: string
    avatar_url: string
  }[]
  // GitHub reactions
  reactions?: #/components/schemas/Reactions
  state: enum[OPEN, CLOSED]
  issue_closed_at?: string
  issue_modified_at?: string
  issue_created_at: string
  // If a maintainer needs to mark this issue as solved
  needs_confirmation_solved: boolean
  // If this issue has been marked as confirmed solved through Polar
  confirmed_solved_at?: string
  funding: {
    funding_goal: {
      // Three letter currency code (eg: USD)
      currency: string
      // Amount in the currencys smallest unit (cents if currency is USD)
      amount: integer
    }
    // Sum of pledges to this isuse (including currently open pledges and pledges that have been paid out). Always in USD.
    pledges_sum?: #/components/schemas/CurrencyAmount
  }
  // The repository that the issue is in
  repository: #/components/schemas/Repository
  // Share of rewrads that will be rewarded to contributors of this issue. A number between 0 and 100 (inclusive).
  upfront_split_to_contributors?: integer
  // If this issue currently has the Polar badge SVG embedded
  pledge_badge_currently_embedded: boolean
  // Optional custom badge SVG promotional content
  badge_custom_content?: string
}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [GET]/api/v1/issues/{id}/body

- Summary  
Get Body

- Security  
HTTPBearer  

#### Responses

- 200 Successful Response

`application/json`

```ts
{}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [GET]/api/v1/issues/for_you

- Summary  
For You

- Security  
HTTPBearer  

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  items: {
    id: string
    // Issue platform (currently always GitHub)
    platform: #/components/schemas/Platforms
    // GitHub #number
    number: integer
    // GitHub issue title
    title: string
    // GitHub issue body
    body?: string
    // Number of GitHub comments made on the issue
    comments?: integer
    labels: {
      name: string
      color: string
    }[]
    // GitHub author
    author?: #/components/schemas/Author
    assignees: {
      id: integer
      login: string
      html_url: string
      avatar_url: string
    }[]
    // GitHub reactions
    reactions?: #/components/schemas/Reactions
    state: enum[OPEN, CLOSED]
    issue_closed_at?: string
    issue_modified_at?: string
    issue_created_at: string
    // If a maintainer needs to mark this issue as solved
    needs_confirmation_solved: boolean
    // If this issue has been marked as confirmed solved through Polar
    confirmed_solved_at?: string
    funding: {
      funding_goal: {
        // Three letter currency code (eg: USD)
        currency: string
        // Amount in the currencys smallest unit (cents if currency is USD)
        amount: integer
      }
      // Sum of pledges to this isuse (including currently open pledges and pledges that have been paid out). Always in USD.
      pledges_sum?: #/components/schemas/CurrencyAmount
    }
    // The repository that the issue is in
    repository: #/components/schemas/Repository
    // Share of rewrads that will be rewarded to contributors of this issue. A number between 0 and 100 (inclusive).
    upfront_split_to_contributors?: integer
    // If this issue currently has the Polar badge SVG embedded
    pledge_badge_currently_embedded: boolean
    // Optional custom badge SVG promotional content
    badge_custom_content?: string
  }[]
  pagination: {
    total_count: integer
    max_page: integer
  }
}
```

***

### [GET]/api/v1/issues/{id}

- Summary  
Get issue (Public API)

- Description  
Get issue

- Security  
HTTPBearer  

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  id: string
  // Issue platform (currently always GitHub)
  platform: #/components/schemas/Platforms
  // GitHub #number
  number: integer
  // GitHub issue title
  title: string
  // GitHub issue body
  body?: string
  // Number of GitHub comments made on the issue
  comments?: integer
  labels: {
    name: string
    color: string
  }[]
  // GitHub author
  author?: #/components/schemas/Author
  assignees: {
    id: integer
    login: string
    html_url: string
    avatar_url: string
  }[]
  // GitHub reactions
  reactions?: #/components/schemas/Reactions
  state: enum[OPEN, CLOSED]
  issue_closed_at?: string
  issue_modified_at?: string
  issue_created_at: string
  // If a maintainer needs to mark this issue as solved
  needs_confirmation_solved: boolean
  // If this issue has been marked as confirmed solved through Polar
  confirmed_solved_at?: string
  funding: {
    funding_goal: {
      // Three letter currency code (eg: USD)
      currency: string
      // Amount in the currencys smallest unit (cents if currency is USD)
      amount: integer
    }
    // Sum of pledges to this isuse (including currently open pledges and pledges that have been paid out). Always in USD.
    pledges_sum?: #/components/schemas/CurrencyAmount
  }
  // The repository that the issue is in
  repository: #/components/schemas/Repository
  // Share of rewrads that will be rewarded to contributors of this issue. A number between 0 and 100 (inclusive).
  upfront_split_to_contributors?: integer
  // If this issue currently has the Polar badge SVG embedded
  pledge_badge_currently_embedded: boolean
  // Optional custom badge SVG promotional content
  badge_custom_content?: string
}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [POST]/api/v1/issues/{id}

- Summary  
Update issue. (Public API)

- Description  
Update issue. Requires authentication.

- Security  
HTTPBearer  

#### RequestBody

- application/json

```ts
{
  funding_goal: {
    // Three letter currency code (eg: USD)
    currency: string
    // Amount in the currencys smallest unit (cents if currency is USD)
    amount: integer
  }
  upfront_split_to_contributors?: integer
  unset_upfront_split_to_contributors?: boolean
}
```

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  id: string
  // Issue platform (currently always GitHub)
  platform: #/components/schemas/Platforms
  // GitHub #number
  number: integer
  // GitHub issue title
  title: string
  // GitHub issue body
  body?: string
  // Number of GitHub comments made on the issue
  comments?: integer
  labels: {
    name: string
    color: string
  }[]
  // GitHub author
  author?: #/components/schemas/Author
  assignees: {
    id: integer
    login: string
    html_url: string
    avatar_url: string
  }[]
  // GitHub reactions
  reactions?: #/components/schemas/Reactions
  state: enum[OPEN, CLOSED]
  issue_closed_at?: string
  issue_modified_at?: string
  issue_created_at: string
  // If a maintainer needs to mark this issue as solved
  needs_confirmation_solved: boolean
  // If this issue has been marked as confirmed solved through Polar
  confirmed_solved_at?: string
  funding: {
    funding_goal: {
      // Three letter currency code (eg: USD)
      currency: string
      // Amount in the currencys smallest unit (cents if currency is USD)
      amount: integer
    }
    // Sum of pledges to this isuse (including currently open pledges and pledges that have been paid out). Always in USD.
    pledges_sum?: #/components/schemas/CurrencyAmount
  }
  // The repository that the issue is in
  repository: #/components/schemas/Repository
  // Share of rewrads that will be rewarded to contributors of this issue. A number between 0 and 100 (inclusive).
  upfront_split_to_contributors?: integer
  // If this issue currently has the Polar badge SVG embedded
  pledge_badge_currently_embedded: boolean
  // Optional custom badge SVG promotional content
  badge_custom_content?: string
}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [POST]/api/v1/issues/{id}/confirm_solved

- Summary  
Mark an issue as confirmed solved. (Public API)

- Description  
Mark an issue as confirmed solved, and configure issue reward splits. Enables payouts of pledges. Can only be done once per issue. Requires authentication.

- Security  
HTTPBearer  

#### RequestBody

- application/json

```ts
{
  splits: {
    organization_id?: string
    github_username?: string
    share_thousands: integer
  }[]
}
```

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  id: string
  // Issue platform (currently always GitHub)
  platform: #/components/schemas/Platforms
  // GitHub #number
  number: integer
  // GitHub issue title
  title: string
  // GitHub issue body
  body?: string
  // Number of GitHub comments made on the issue
  comments?: integer
  labels: {
    name: string
    color: string
  }[]
  // GitHub author
  author?: #/components/schemas/Author
  assignees: {
    id: integer
    login: string
    html_url: string
    avatar_url: string
  }[]
  // GitHub reactions
  reactions?: #/components/schemas/Reactions
  state: enum[OPEN, CLOSED]
  issue_closed_at?: string
  issue_modified_at?: string
  issue_created_at: string
  // If a maintainer needs to mark this issue as solved
  needs_confirmation_solved: boolean
  // If this issue has been marked as confirmed solved through Polar
  confirmed_solved_at?: string
  funding: {
    funding_goal: {
      // Three letter currency code (eg: USD)
      currency: string
      // Amount in the currencys smallest unit (cents if currency is USD)
      amount: integer
    }
    // Sum of pledges to this isuse (including currently open pledges and pledges that have been paid out). Always in USD.
    pledges_sum?: #/components/schemas/CurrencyAmount
  }
  // The repository that the issue is in
  repository: #/components/schemas/Repository
  // Share of rewrads that will be rewarded to contributors of this issue. A number between 0 and 100 (inclusive).
  upfront_split_to_contributors?: integer
  // If this issue currently has the Polar badge SVG embedded
  pledge_badge_currently_embedded: boolean
  // Optional custom badge SVG promotional content
  badge_custom_content?: string
}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [POST]/api/v1/issues/{id}/add_badge

- Summary  
Add Polar Badge

- Security  
HTTPBearer  

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  id: string
  // Issue platform (currently always GitHub)
  platform: #/components/schemas/Platforms
  // GitHub #number
  number: integer
  // GitHub issue title
  title: string
  // GitHub issue body
  body?: string
  // Number of GitHub comments made on the issue
  comments?: integer
  labels: {
    name: string
    color: string
  }[]
  // GitHub author
  author?: #/components/schemas/Author
  assignees: {
    id: integer
    login: string
    html_url: string
    avatar_url: string
  }[]
  // GitHub reactions
  reactions?: #/components/schemas/Reactions
  state: enum[OPEN, CLOSED]
  issue_closed_at?: string
  issue_modified_at?: string
  issue_created_at: string
  // If a maintainer needs to mark this issue as solved
  needs_confirmation_solved: boolean
  // If this issue has been marked as confirmed solved through Polar
  confirmed_solved_at?: string
  funding: {
    funding_goal: {
      // Three letter currency code (eg: USD)
      currency: string
      // Amount in the currencys smallest unit (cents if currency is USD)
      amount: integer
    }
    // Sum of pledges to this isuse (including currently open pledges and pledges that have been paid out). Always in USD.
    pledges_sum?: #/components/schemas/CurrencyAmount
  }
  // The repository that the issue is in
  repository: #/components/schemas/Repository
  // Share of rewrads that will be rewarded to contributors of this issue. A number between 0 and 100 (inclusive).
  upfront_split_to_contributors?: integer
  // If this issue currently has the Polar badge SVG embedded
  pledge_badge_currently_embedded: boolean
  // Optional custom badge SVG promotional content
  badge_custom_content?: string
}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [POST]/api/v1/issues/{id}/remove_badge

- Summary  
Remove Polar Badge

- Security  
HTTPBearer  

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  id: string
  // Issue platform (currently always GitHub)
  platform: #/components/schemas/Platforms
  // GitHub #number
  number: integer
  // GitHub issue title
  title: string
  // GitHub issue body
  body?: string
  // Number of GitHub comments made on the issue
  comments?: integer
  labels: {
    name: string
    color: string
  }[]
  // GitHub author
  author?: #/components/schemas/Author
  assignees: {
    id: integer
    login: string
    html_url: string
    avatar_url: string
  }[]
  // GitHub reactions
  reactions?: #/components/schemas/Reactions
  state: enum[OPEN, CLOSED]
  issue_closed_at?: string
  issue_modified_at?: string
  issue_created_at: string
  // If a maintainer needs to mark this issue as solved
  needs_confirmation_solved: boolean
  // If this issue has been marked as confirmed solved through Polar
  confirmed_solved_at?: string
  funding: {
    funding_goal: {
      // Three letter currency code (eg: USD)
      currency: string
      // Amount in the currencys smallest unit (cents if currency is USD)
      amount: integer
    }
    // Sum of pledges to this isuse (including currently open pledges and pledges that have been paid out). Always in USD.
    pledges_sum?: #/components/schemas/CurrencyAmount
  }
  // The repository that the issue is in
  repository: #/components/schemas/Repository
  // Share of rewrads that will be rewarded to contributors of this issue. A number between 0 and 100 (inclusive).
  upfront_split_to_contributors?: integer
  // If this issue currently has the Polar badge SVG embedded
  pledge_badge_currently_embedded: boolean
  // Optional custom badge SVG promotional content
  badge_custom_content?: string
}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [POST]/api/v1/issues/{id}/comment

- Summary  
Add Issue Comment

- Security  
HTTPBearer  

#### RequestBody

- application/json

```ts
{
  message: string
  append_badge?: boolean
}
```

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  id: string
  // Issue platform (currently always GitHub)
  platform: #/components/schemas/Platforms
  // GitHub #number
  number: integer
  // GitHub issue title
  title: string
  // GitHub issue body
  body?: string
  // Number of GitHub comments made on the issue
  comments?: integer
  labels: {
    name: string
    color: string
  }[]
  // GitHub author
  author?: #/components/schemas/Author
  assignees: {
    id: integer
    login: string
    html_url: string
    avatar_url: string
  }[]
  // GitHub reactions
  reactions?: #/components/schemas/Reactions
  state: enum[OPEN, CLOSED]
  issue_closed_at?: string
  issue_modified_at?: string
  issue_created_at: string
  // If a maintainer needs to mark this issue as solved
  needs_confirmation_solved: boolean
  // If this issue has been marked as confirmed solved through Polar
  confirmed_solved_at?: string
  funding: {
    funding_goal: {
      // Three letter currency code (eg: USD)
      currency: string
      // Amount in the currencys smallest unit (cents if currency is USD)
      amount: integer
    }
    // Sum of pledges to this isuse (including currently open pledges and pledges that have been paid out). Always in USD.
    pledges_sum?: #/components/schemas/CurrencyAmount
  }
  // The repository that the issue is in
  repository: #/components/schemas/Repository
  // Share of rewrads that will be rewarded to contributors of this issue. A number between 0 and 100 (inclusive).
  upfront_split_to_contributors?: integer
  // If this issue currently has the Polar badge SVG embedded
  pledge_badge_currently_embedded: boolean
  // Optional custom badge SVG promotional content
  badge_custom_content?: string
}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [POST]/api/v1/issues/{id}/badge_with_message

- Summary  
Badge With Message

- Security  
HTTPBearer  

#### RequestBody

- application/json

```ts
{
  message: string
}
```

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  id: string
  // Issue platform (currently always GitHub)
  platform: #/components/schemas/Platforms
  // GitHub #number
  number: integer
  // GitHub issue title
  title: string
  // GitHub issue body
  body?: string
  // Number of GitHub comments made on the issue
  comments?: integer
  labels: {
    name: string
    color: string
  }[]
  // GitHub author
  author?: #/components/schemas/Author
  assignees: {
    id: integer
    login: string
    html_url: string
    avatar_url: string
  }[]
  // GitHub reactions
  reactions?: #/components/schemas/Reactions
  state: enum[OPEN, CLOSED]
  issue_closed_at?: string
  issue_modified_at?: string
  issue_created_at: string
  // If a maintainer needs to mark this issue as solved
  needs_confirmation_solved: boolean
  // If this issue has been marked as confirmed solved through Polar
  confirmed_solved_at?: string
  funding: {
    funding_goal: {
      // Three letter currency code (eg: USD)
      currency: string
      // Amount in the currencys smallest unit (cents if currency is USD)
      amount: integer
    }
    // Sum of pledges to this isuse (including currently open pledges and pledges that have been paid out). Always in USD.
    pledges_sum?: #/components/schemas/CurrencyAmount
  }
  // The repository that the issue is in
  repository: #/components/schemas/Repository
  // Share of rewrads that will be rewarded to contributors of this issue. A number between 0 and 100 (inclusive).
  upfront_split_to_contributors?: integer
  // If this issue currently has the Polar badge SVG embedded
  pledge_badge_currently_embedded: boolean
  // Optional custom badge SVG promotional content
  badge_custom_content?: string
}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [GET]/api/v1/pledges/search

- Summary  
Search pledges (Public API)

- Description  
Search pledges. Requires authentication. The user can only read pledges that they have made (personally or via an organization) or received (to organizations that they are a member of).

- Security  
HTTPBearer  

#### Parameters(Query)

```ts
// An enumeration.
platform?: enum[github]
```

```ts
// Search pledges in the organization with this name. Requires platform to be set.
organization_name?: string
```

```ts
// Search pledges in the repository with this name. Can only be used if organization_name is set.
repository_name?: string
```

```ts
// Search pledges to this issue
issue_id?: string
```

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  items: {
    // Pledge ID
    id: string
    // When the pledge was created
    created_at: string
    // Amount pledged towards the issue
    amount: #/components/schemas/CurrencyAmount
    // Current state of the pledge
    state: #/components/schemas/PledgeState
    // Type of pledge
    type: #/components/schemas/PledgeType
    // If and when the pledge was refunded to the pledger
    refunded_at?: string
    // When the payout is scheduled to be made to the maintainers behind the issue. Disputes must be made before this date.
    scheduled_payout_at?: string
    // The issue that the pledge was made towards
    issue: #/components/schemas/Issue
    // The user or organization that made this pledge
    pledger?: #/components/schemas/Pledger
    // URL of invoice for this pledge
    hosted_invoice_url?: string
    // If the currently authenticated subject can perform admin actions on behalf of the maker of the peldge
    authed_can_admin_sender?: boolean
    // If the currently authenticated subject can perform admin actions on behalf of the receiver of the peldge
    authed_can_admin_received?: boolean
  }[]
  pagination: {
    total_count: integer
    max_page: integer
  }
}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [GET]/api/v1/pledges/summary

- Summary  
Get pledges summary (Public API)

- Description  
Get summary of pledges for resource.

- Security  
HTTPBearer  

#### Parameters(Query)

```ts
issue_id: string
```

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  funding: {
    funding_goal: {
      // Three letter currency code (eg: USD)
      currency: string
      // Amount in the currencys smallest unit (cents if currency is USD)
      amount: integer
    }
    // Sum of pledges to this isuse (including currently open pledges and pledges that have been paid out). Always in USD.
    pledges_sum?: #/components/schemas/CurrencyAmount
  }
  pledges: {
    // Type of pledge
    type: #/components/schemas/PledgeType
    pledger: {
      name: string
      github_username?: string
      avatar_url?: string
    }
  }[]
}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [GET]/api/v1/pledges/{id}

- Summary  
Get pledge (Public API)

- Description  
Get a pledge. Requires authentication.

- Security  
HTTPBearer  

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  // Pledge ID
  id: string
  // When the pledge was created
  created_at: string
  // Amount pledged towards the issue
  amount: #/components/schemas/CurrencyAmount
  // Current state of the pledge
  state: #/components/schemas/PledgeState
  // Type of pledge
  type: #/components/schemas/PledgeType
  // If and when the pledge was refunded to the pledger
  refunded_at?: string
  // When the payout is scheduled to be made to the maintainers behind the issue. Disputes must be made before this date.
  scheduled_payout_at?: string
  // The issue that the pledge was made towards
  issue: #/components/schemas/Issue
  // The user or organization that made this pledge
  pledger?: #/components/schemas/Pledger
  // URL of invoice for this pledge
  hosted_invoice_url?: string
  // If the currently authenticated subject can perform admin actions on behalf of the maker of the peldge
  authed_can_admin_sender?: boolean
  // If the currently authenticated subject can perform admin actions on behalf of the receiver of the peldge
  authed_can_admin_received?: boolean
}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [POST]/api/v1/pledges

- Summary  
Create

- Description  
Creates a pledge from a payment intent

- Security  
HTTPBearer  

#### RequestBody

- application/json

```ts
{
  payment_intent_id: string
}
```

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  // Pledge ID
  id: string
  // When the pledge was created
  created_at: string
  // Amount pledged towards the issue
  amount: #/components/schemas/CurrencyAmount
  // Current state of the pledge
  state: #/components/schemas/PledgeState
  // Type of pledge
  type: #/components/schemas/PledgeType
  // If and when the pledge was refunded to the pledger
  refunded_at?: string
  // When the payout is scheduled to be made to the maintainers behind the issue. Disputes must be made before this date.
  scheduled_payout_at?: string
  // The issue that the pledge was made towards
  issue: #/components/schemas/Issue
  // The user or organization that made this pledge
  pledger?: #/components/schemas/Pledger
  // URL of invoice for this pledge
  hosted_invoice_url?: string
  // If the currently authenticated subject can perform admin actions on behalf of the maker of the peldge
  authed_can_admin_sender?: boolean
  // If the currently authenticated subject can perform admin actions on behalf of the receiver of the peldge
  authed_can_admin_received?: boolean
}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [POST]/api/v1/pledges/pay_on_completion

- Summary  
Create Pay On Completion

- Description  
Creates a pay_on_completion type of pledge

- Security  
HTTPBearer  

#### RequestBody

- application/json

```ts
{
  issue_id: string
  amount: integer
}
```

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  // Pledge ID
  id: string
  // When the pledge was created
  created_at: string
  // Amount pledged towards the issue
  amount: #/components/schemas/CurrencyAmount
  // Current state of the pledge
  state: #/components/schemas/PledgeState
  // Type of pledge
  type: #/components/schemas/PledgeType
  // If and when the pledge was refunded to the pledger
  refunded_at?: string
  // When the payout is scheduled to be made to the maintainers behind the issue. Disputes must be made before this date.
  scheduled_payout_at?: string
  // The issue that the pledge was made towards
  issue: #/components/schemas/Issue
  // The user or organization that made this pledge
  pledger?: #/components/schemas/Pledger
  // URL of invoice for this pledge
  hosted_invoice_url?: string
  // If the currently authenticated subject can perform admin actions on behalf of the maker of the peldge
  authed_can_admin_sender?: boolean
  // If the currently authenticated subject can perform admin actions on behalf of the receiver of the peldge
  authed_can_admin_received?: boolean
}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [POST]/api/v1/pledges/{id}/create_invoice

- Summary  
Create Invoice

- Description  
Creates an invoice for pay_on_completion pledges

- Security  
HTTPBearer  

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  // Pledge ID
  id: string
  // When the pledge was created
  created_at: string
  // Amount pledged towards the issue
  amount: #/components/schemas/CurrencyAmount
  // Current state of the pledge
  state: #/components/schemas/PledgeState
  // Type of pledge
  type: #/components/schemas/PledgeType
  // If and when the pledge was refunded to the pledger
  refunded_at?: string
  // When the payout is scheduled to be made to the maintainers behind the issue. Disputes must be made before this date.
  scheduled_payout_at?: string
  // The issue that the pledge was made towards
  issue: #/components/schemas/Issue
  // The user or organization that made this pledge
  pledger?: #/components/schemas/Pledger
  // URL of invoice for this pledge
  hosted_invoice_url?: string
  // If the currently authenticated subject can perform admin actions on behalf of the maker of the peldge
  authed_can_admin_sender?: boolean
  // If the currently authenticated subject can perform admin actions on behalf of the receiver of the peldge
  authed_can_admin_received?: boolean
}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [POST]/api/v1/pledges/payment_intent

- Summary  
Create Payment Intent

- Security  
HTTPBearer  

#### RequestBody

- application/json

```ts
{
  issue_id: string
  email: string
  amount: integer
  setup_future_usage?: enum[on_session]
}
```

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  payment_intent_id: string
  amount: integer
  fee: integer
  amount_including_fee: integer
  client_secret?: string
}
```

- 400 Bad Request

- 403 Forbidden

- 404 Not Found

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [PATCH]/api/v1/pledges/payment_intent/{id}

- Summary  
Update Payment Intent

- Security  
HTTPBearer  

#### RequestBody

- application/json

```ts
{
  email: string
  amount: integer
  setup_future_usage?: enum[on_session]
}
```

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  payment_intent_id: string
  amount: integer
  fee: integer
  amount_including_fee: integer
  client_secret?: string
}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [POST]/api/v1/pledges/{pledge_id}/dispute

- Summary  
Dispute Pledge

- Security  
HTTPBearer  

#### Parameters(Query)

```ts
reason: string
```

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  // Pledge ID
  id: string
  // When the pledge was created
  created_at: string
  // Amount pledged towards the issue
  amount: #/components/schemas/CurrencyAmount
  // Current state of the pledge
  state: #/components/schemas/PledgeState
  // Type of pledge
  type: #/components/schemas/PledgeType
  // If and when the pledge was refunded to the pledger
  refunded_at?: string
  // When the payout is scheduled to be made to the maintainers behind the issue. Disputes must be made before this date.
  scheduled_payout_at?: string
  // The issue that the pledge was made towards
  issue: #/components/schemas/Issue
  // The user or organization that made this pledge
  pledger?: #/components/schemas/Pledger
  // URL of invoice for this pledge
  hosted_invoice_url?: string
  // If the currently authenticated subject can perform admin actions on behalf of the maker of the peldge
  authed_can_admin_sender?: boolean
  // If the currently authenticated subject can perform admin actions on behalf of the receiver of the peldge
  authed_can_admin_received?: boolean
}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [GET]/api/v1/user/stream

- Summary  
User Stream

- Security  
HTTPBearer  

#### Responses

- 200 Successful Response

`application/json`

```ts
{}
```

***

### [GET]/api/v1/{platform}/{org_name}/stream

- Summary  
User Org Stream

- Security  
HTTPBearer  

#### Responses

- 200 Successful Response

`application/json`

```ts
{}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [GET]/api/v1/{platform}/{org_name}/{repo_name}/stream

- Summary  
User Org Repo Stream

- Security  
HTTPBearer  

#### Responses

- 200 Successful Response

`application/json`

```ts
{}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [GET]/api/v1/organizations

- Summary  
List organizations (Public API)

- Description  
List organizations that the authenticated user is a member of. Requires authentication.

- Security  
HTTPBearer  

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  items: {
    id: string
    // An enumeration.
    platform: enum[github]
    name: string
    avatar_url: string
    bio?: string
    pretty_name?: string
    company?: string
    blog?: string
    location?: string
    email?: string
    twitter_username?: string
    pledge_minimum_amount: integer
    pledge_badge_show_amount: boolean
  }[]
  pagination: {
    total_count: integer
    max_page: integer
  }
}
```

***

### [GET]/api/v1/organizations/search

- Summary  
Search organizations (Public API)

- Description  
Search organizations.

- Security  
HTTPBearer  

#### Parameters(Query)

```ts
// An enumeration.
platform?: enum[github]
```

```ts
organization_name?: string
```

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  items: {
    id: string
    // An enumeration.
    platform: enum[github]
    name: string
    avatar_url: string
    bio?: string
    pretty_name?: string
    company?: string
    blog?: string
    location?: string
    email?: string
    twitter_username?: string
    pledge_minimum_amount: integer
    pledge_badge_show_amount: boolean
  }[]
  pagination: {
    total_count: integer
    max_page: integer
  }
}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [GET]/api/v1/organizations/lookup

- Summary  
Lookup organization (Public API)

- Description  
Lookup organization. Like search but returns at only one organization.

- Security  
HTTPBearer  

#### Parameters(Query)

```ts
// An enumeration.
platform?: enum[github]
```

```ts
organization_name?: string
```

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  id: string
  // An enumeration.
  platform: enum[github]
  name: string
  avatar_url: string
  bio?: string
  pretty_name?: string
  company?: string
  blog?: string
  location?: string
  email?: string
  twitter_username?: string
  pledge_minimum_amount: integer
  pledge_badge_show_amount: boolean
}
```

- 404 Not Found

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [GET]/api/v1/organizations/{id}

- Summary  
Get organization (Public API)

- Description  
Get organization

- Security  
HTTPBearer  

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  id: string
  // An enumeration.
  platform: enum[github]
  name: string
  avatar_url: string
  bio?: string
  pretty_name?: string
  company?: string
  blog?: string
  location?: string
  email?: string
  twitter_username?: string
  pledge_minimum_amount: integer
  pledge_badge_show_amount: boolean
}
```

- 404 Not Found

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [GET]/api/v1/organizations/{id}/badge_settings

- Summary  
Get badge settings (Internal API)

- Security  
HTTPBearer  

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  show_amount: boolean
  minimum_amount: integer
  message?: string
  repositories: {
    id: string
    avatar_url?: string
    name: string
    synced_issues: integer
    open_issues: integer
    auto_embedded_issues: integer
    label_embedded_issues: integer
    pull_requests: integer
    badge_auto_embed: boolean
    badge_label: string
    is_private: boolean
    is_sync_completed: boolean
  }[]
}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

***

### [POST]/api/v1/organizations/{id}/badge_settings

- Summary  
Update badge settings (Internal API)

- Security  
HTTPBearer  

#### RequestBody

- application/json

```ts
{
  show_amount: boolean
  minimum_amount: integer
  message: string
  repositories: {
    id: string
    badge_auto_embed: boolean
    retroactive: boolean
  }[]
}
```

#### Responses

- 200 Successful Response

`application/json`

```ts
{
  show_amount: boolean
  minimum_amount: integer
  message: string
  repositories: {
    id: string
    badge_auto_embed: boolean
    retroactive: boolean
  }[]
}
```

- 422 Validation Error

`application/json`

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

## References

### #/components/schemas/Account

```ts
{
  id: string
  // An enumeration.
  account_type: enum[stripe, open_collective]
  stripe_id?: string
  open_collective_slug?: string
  is_details_submitted?: boolean
  country: string
}
```

### #/components/schemas/AccountCreate

```ts
{
  user_id?: string
  organization_id?: string
  // An enumeration.
  account_type: enum[stripe, open_collective]
  open_collective_slug?: string
  // Two letter uppercase country code
  country: string
}
```

### #/components/schemas/AccountLink

```ts
{
  url: string
}
```

### #/components/schemas/AccountType

```ts
{
  "title": "AccountType",
  "enum": [
    "stripe",
    "open_collective"
  ],
  "type": "string",
  "description": "An enumeration."
}
```

### #/components/schemas/Assignee

```ts
{
  id: integer
  login: string
  html_url: string
  avatar_url: string
}
```

### #/components/schemas/Author

```ts
{
  id: integer
  login: string
  html_url: string
  avatar_url: string
}
```

### #/components/schemas/AuthorizationResponse

```ts
{
  authorization_url: string
}
```

### #/components/schemas/BackofficeBadge

```ts
{
  org_slug: string
  repo_slug: string
  issue_number: integer
  action: enum[embed, remove]
}
```

### #/components/schemas/BackofficeBadgeResponse

```ts
{
  org_slug: string
  repo_slug: string
  issue_number: integer
  action: enum[embed, remove]
  success: boolean
}
```

### #/components/schemas/BackofficePledge

```ts
{
  // Pledge ID
  id: string
  // When the pledge was created
  created_at: string
  // Amount pledged towards the issue
  amount: #/components/schemas/CurrencyAmount
  // Current state of the pledge
  state: #/components/schemas/PledgeState
  // Type of pledge
  type: #/components/schemas/PledgeType
  // If and when the pledge was refunded to the pledger
  refunded_at?: string
  // When the payout is scheduled to be made to the maintainers behind the issue. Disputes must be made before this date.
  scheduled_payout_at?: string
  // The issue that the pledge was made towards
  issue: #/components/schemas/Issue
  // The user or organization that made this pledge
  pledger?: #/components/schemas/Pledger
  // URL of invoice for this pledge
  hosted_invoice_url?: string
  // If the currently authenticated subject can perform admin actions on behalf of the maker of the peldge
  authed_can_admin_sender?: boolean
  // If the currently authenticated subject can perform admin actions on behalf of the receiver of the peldge
  authed_can_admin_received?: boolean
  payment_id?: string
  dispute_reason?: string
  disputed_by_user_id?: string
  disputed_at?: string
  pledger_email?: string
}
```

### #/components/schemas/BackofficeReward

```ts
{
  // The pledge that the reward was split from
  pledge: #/components/schemas/Pledge
  // The user that received the reward (if any)
  user?: #/components/schemas/User
  // The organization that received the reward (if any)
  organization?: #/components/schemas/Organization
  amount: {
    // Three letter currency code (eg: USD)
    currency: string
    // Amount in the currencys smallest unit (cents if currency is USD)
    amount: integer
  }
  // An enumeration.
  state: enum[pending, paid]
  // If and when the reward was paid out.
  paid_at?: string
  transfer_id?: string
  issue_reward_id: string
  pledge_payment_id?: string
  pledger_email?: string
}
```

### #/components/schemas/ConfirmIssue

```ts
{
  splits: {
    organization_id?: string
    github_username?: string
    share_thousands: integer
  }[]
}
```

### #/components/schemas/ConfirmIssueSplit

```ts
{
  organization_id?: string
  github_username?: string
  share_thousands: integer
}
```

### #/components/schemas/CreatePersonalAccessToken

```ts
{
  comment: string
}
```

### #/components/schemas/CreatePersonalAccessTokenResponse

```ts
{
  id: string
  created_at: string
  last_used_at?: string
  expires_at: string
  comment: string
  token: string
}
```

### #/components/schemas/CreatePledgeFromPaymentIntent

```ts
{
  payment_intent_id: string
}
```

### #/components/schemas/CreatePledgePayLater

```ts
{
  issue_id: string
  amount: integer
}
```

### #/components/schemas/CurrencyAmount

```ts
{
  // Three letter currency code (eg: USD)
  currency: string
  // Amount in the currencys smallest unit (cents if currency is USD)
  amount: integer
}
```

### #/components/schemas/Entry_Any_

```ts
{
  type: string
  id: Partial(string) & Partial(string)
  relationships: {
  }
}
```

### #/components/schemas/Entry_Issue_

```ts
{
  type: string
  id: Partial(string) & Partial(string)
  attributes: {
    id: string
    // Issue platform (currently always GitHub)
    platform: #/components/schemas/Platforms
    // GitHub #number
    number: integer
    // GitHub issue title
    title: string
    // GitHub issue body
    body?: string
    // Number of GitHub comments made on the issue
    comments?: integer
    labels: {
      name: string
      color: string
    }[]
    // GitHub author
    author?: #/components/schemas/Author
    assignees: {
      id: integer
      login: string
      html_url: string
      avatar_url: string
    }[]
    // GitHub reactions
    reactions?: #/components/schemas/Reactions
    state: enum[OPEN, CLOSED]
    issue_closed_at?: string
    issue_modified_at?: string
    issue_created_at: string
    // If a maintainer needs to mark this issue as solved
    needs_confirmation_solved: boolean
    // If this issue has been marked as confirmed solved through Polar
    confirmed_solved_at?: string
    funding: {
      funding_goal: {
        // Three letter currency code (eg: USD)
        currency: string
        // Amount in the currencys smallest unit (cents if currency is USD)
        amount: integer
      }
      // Sum of pledges to this isuse (including currently open pledges and pledges that have been paid out). Always in USD.
      pledges_sum?: #/components/schemas/CurrencyAmount
    }
    // The repository that the issue is in
    repository: #/components/schemas/Repository
    // Share of rewrads that will be rewarded to contributors of this issue. A number between 0 and 100 (inclusive).
    upfront_split_to_contributors?: integer
    // If this issue currently has the Polar badge SVG embedded
    pledge_badge_currently_embedded: boolean
    // Optional custom badge SVG promotional content
    badge_custom_content?: string
  }
  relationships: {
  }
}
```

### #/components/schemas/ExternalGitHubCommitReference

```ts
{
  author_login: string
  author_avatar: string
  sha: string
  organization_name: string
  repository_name: string
  branch_name?: string
  message?: string
}
```

### #/components/schemas/ExternalGitHubPullRequestReference

```ts
{
  title: string
  author_login: string
  author_avatar: string
  number: integer
  organization_name: string
  repository_name: string
  state: string
}
```

### #/components/schemas/Funding

```ts
{
  funding_goal: {
    // Three letter currency code (eg: USD)
    currency: string
    // Amount in the currencys smallest unit (cents if currency is USD)
    amount: integer
  }
  // Sum of pledges to this isuse (including currently open pledges and pledges that have been paid out). Always in USD.
  pledges_sum?: #/components/schemas/CurrencyAmount
}
```

### #/components/schemas/GithubBadgeRead

```ts
{
  badge_type: enum[pledge]
  amount: integer
  funding: {
    funding_goal: {
      // Three letter currency code (eg: USD)
      currency: string
      // Amount in the currencys smallest unit (cents if currency is USD)
      amount: integer
    }
    // Sum of pledges to this isuse (including currently open pledges and pledges that have been paid out). Always in USD.
    pledges_sum?: #/components/schemas/CurrencyAmount
  }
}
```

### #/components/schemas/GithubUser

```ts
{
  username: string
  avatar_url: string
}
```

### #/components/schemas/HTTPValidationError

```ts
{
  detail: {
    loc?: Partial(string) & Partial(integer)[]
    msg: string
    type: string
  }[]
}
```

### #/components/schemas/InstallationCreate

```ts
{
  platform: enum[github]
  external_id: integer
}
```

### #/components/schemas/Issue

```ts
{
  id: string
  // Issue platform (currently always GitHub)
  platform: #/components/schemas/Platforms
  // GitHub #number
  number: integer
  // GitHub issue title
  title: string
  // GitHub issue body
  body?: string
  // Number of GitHub comments made on the issue
  comments?: integer
  labels: {
    name: string
    color: string
  }[]
  // GitHub author
  author?: #/components/schemas/Author
  assignees: {
    id: integer
    login: string
    html_url: string
    avatar_url: string
  }[]
  // GitHub reactions
  reactions?: #/components/schemas/Reactions
  state: enum[OPEN, CLOSED]
  issue_closed_at?: string
  issue_modified_at?: string
  issue_created_at: string
  // If a maintainer needs to mark this issue as solved
  needs_confirmation_solved: boolean
  // If this issue has been marked as confirmed solved through Polar
  confirmed_solved_at?: string
  funding: {
    funding_goal: {
      // Three letter currency code (eg: USD)
      currency: string
      // Amount in the currencys smallest unit (cents if currency is USD)
      amount: integer
    }
    // Sum of pledges to this isuse (including currently open pledges and pledges that have been paid out). Always in USD.
    pledges_sum?: #/components/schemas/CurrencyAmount
  }
  // The repository that the issue is in
  repository: #/components/schemas/Repository
  // Share of rewrads that will be rewarded to contributors of this issue. A number between 0 and 100 (inclusive).
  upfront_split_to_contributors?: integer
  // If this issue currently has the Polar badge SVG embedded
  pledge_badge_currently_embedded: boolean
  // Optional custom badge SVG promotional content
  badge_custom_content?: string
}
```

### #/components/schemas/IssueExtensionRead

```ts
{
  number: integer
  pledges: {
    // Pledge ID
    id: string
    // When the pledge was created
    created_at: string
    // Amount pledged towards the issue
    amount: #/components/schemas/CurrencyAmount
    // Current state of the pledge
    state: #/components/schemas/PledgeState
    // Type of pledge
    type: #/components/schemas/PledgeType
    // If and when the pledge was refunded to the pledger
    refunded_at?: string
    // When the payout is scheduled to be made to the maintainers behind the issue. Disputes must be made before this date.
    scheduled_payout_at?: string
    // The issue that the pledge was made towards
    issue: #/components/schemas/Issue
    // The user or organization that made this pledge
    pledger?: #/components/schemas/Pledger
    // URL of invoice for this pledge
    hosted_invoice_url?: string
    // If the currently authenticated subject can perform admin actions on behalf of the maker of the peldge
    authed_can_admin_sender?: boolean
    // If the currently authenticated subject can perform admin actions on behalf of the receiver of the peldge
    authed_can_admin_received?: boolean
  }[]
  references: {
    id: string
    // An enumeration.
    type: enum[pull_request, external_github_pull_request, external_github_commit]
    payload: Partial(#/components/schemas/PullRequestReference) & Partial(#/components/schemas/ExternalGitHubPullRequestReference) & Partial(#/components/schemas/ExternalGitHubCommitReference)
    pullRequestReference: {
      id: string
      title: string
      author_login: string
      author_avatar: string
      number: integer
      additions: integer
      deletions: integer
      state: string
      created_at: string
      merged_at?: string
      closed_at?: string
      is_draft: boolean
    }
    externalGitHubPullRequestReference: {
      title: string
      author_login: string
      author_avatar: string
      number: integer
      organization_name: string
      repository_name: string
      state: string
    }
    externalGitHubCommitReference: {
      author_login: string
      author_avatar: string
      sha: string
      organization_name: string
      repository_name: string
      branch_name?: string
      message?: string
    }
  }[]
  issue: {
    id: string
    // Issue platform (currently always GitHub)
    platform: #/components/schemas/Platforms
    // GitHub #number
    number: integer
    // GitHub issue title
    title: string
    // GitHub issue body
    body?: string
    // Number of GitHub comments made on the issue
    comments?: integer
    labels: {
      name: string
      color: string
    }[]
    // GitHub author
    author?: #/components/schemas/Author
    assignees: {
      id: integer
      login: string
      html_url: string
      avatar_url: string
    }[]
    // GitHub reactions
    reactions?: #/components/schemas/Reactions
    state: enum[OPEN, CLOSED]
    issue_closed_at?: string
    issue_modified_at?: string
    issue_created_at: string
    // If a maintainer needs to mark this issue as solved
    needs_confirmation_solved: boolean
    // If this issue has been marked as confirmed solved through Polar
    confirmed_solved_at?: string
    funding: {
      funding_goal: {
        // Three letter currency code (eg: USD)
        currency: string
        // Amount in the currencys smallest unit (cents if currency is USD)
        amount: integer
      }
      // Sum of pledges to this isuse (including currently open pledges and pledges that have been paid out). Always in USD.
      pledges_sum?: #/components/schemas/CurrencyAmount
    }
    // The repository that the issue is in
    repository: #/components/schemas/Repository
    // Share of rewrads that will be rewarded to contributors of this issue. A number between 0 and 100 (inclusive).
    upfront_split_to_contributors?: integer
    // If this issue currently has the Polar badge SVG embedded
    pledge_badge_currently_embedded: boolean
    // Optional custom badge SVG promotional content
    badge_custom_content?: string
  }
}
```

### #/components/schemas/IssueFunding

```ts
{
  issue: {
    id: string
    // Issue platform (currently always GitHub)
    platform: #/components/schemas/Platforms
    // GitHub #number
    number: integer
    // GitHub issue title
    title: string
    // GitHub issue body
    body?: string
    // Number of GitHub comments made on the issue
    comments?: integer
    labels: {
      name: string
      color: string
    }[]
    // GitHub author
    author?: #/components/schemas/Author
    assignees: {
      id: integer
      login: string
      html_url: string
      avatar_url: string
    }[]
    // GitHub reactions
    reactions?: #/components/schemas/Reactions
    state: enum[OPEN, CLOSED]
    issue_closed_at?: string
    issue_modified_at?: string
    issue_created_at: string
    // If a maintainer needs to mark this issue as solved
    needs_confirmation_solved: boolean
    // If this issue has been marked as confirmed solved through Polar
    confirmed_solved_at?: string
    funding: {
      funding_goal: {
        // Three letter currency code (eg: USD)
        currency: string
        // Amount in the currencys smallest unit (cents if currency is USD)
        amount: integer
      }
      // Sum of pledges to this isuse (including currently open pledges and pledges that have been paid out). Always in USD.
      pledges_sum?: #/components/schemas/CurrencyAmount
    }
    // The repository that the issue is in
    repository: #/components/schemas/Repository
    // Share of rewrads that will be rewarded to contributors of this issue. A number between 0 and 100 (inclusive).
    upfront_split_to_contributors?: integer
    // If this issue currently has the Polar badge SVG embedded
    pledge_badge_currently_embedded: boolean
    // Optional custom badge SVG promotional content
    badge_custom_content?: string
  }
  funding_goal:#/components/schemas/CurrencyAmount
  total:#/components/schemas/CurrencyAmount
  pledges_summaries: {
    pay_upfront: {
      total:#/components/schemas/CurrencyAmount
      pledgers: {
        name: string
        github_username?: string
        avatar_url?: string
      }[]
    }
    pay_on_completion:#/components/schemas/PledgesSummary
    pay_directly:#/components/schemas/PledgesSummary
  }
}
```

### #/components/schemas/IssueListResponse

```ts
{
  data: {
    type: string
    id: Partial(string) & Partial(string)
    attributes: {
      id: string
      // Issue platform (currently always GitHub)
      platform: #/components/schemas/Platforms
      // GitHub #number
      number: integer
      // GitHub issue title
      title: string
      // GitHub issue body
      body?: string
      // Number of GitHub comments made on the issue
      comments?: integer
      labels: {
        name: string
        color: string
      }[]
      // GitHub author
      author?: #/components/schemas/Author
      assignees: {
        id: integer
        login: string
        html_url: string
        avatar_url: string
      }[]
      // GitHub reactions
      reactions?: #/components/schemas/Reactions
      state: enum[OPEN, CLOSED]
      issue_closed_at?: string
      issue_modified_at?: string
      issue_created_at: string
      // If a maintainer needs to mark this issue as solved
      needs_confirmation_solved: boolean
      // If this issue has been marked as confirmed solved through Polar
      confirmed_solved_at?: string
      funding: {
        funding_goal: {
          // Three letter currency code (eg: USD)
          currency: string
          // Amount in the currencys smallest unit (cents if currency is USD)
          amount: integer
        }
        // Sum of pledges to this isuse (including currently open pledges and pledges that have been paid out). Always in USD.
        pledges_sum?: #/components/schemas/CurrencyAmount
      }
      // The repository that the issue is in
      repository: #/components/schemas/Repository
      // Share of rewrads that will be rewarded to contributors of this issue. A number between 0 and 100 (inclusive).
      upfront_split_to_contributors?: integer
      // If this issue currently has the Polar badge SVG embedded
      pledge_badge_currently_embedded: boolean
      // Optional custom badge SVG promotional content
      badge_custom_content?: string
    }
    relationships: {
    }
  }[]
  included: {
    type: string
    id: Partial(string) & Partial(string)
    relationships: {
    }
  }[]
  pagination: {
    total_count: integer
    page: integer
    next_page?: integer
  }
}
```

### #/components/schemas/IssueListType

```ts
{
  "title": "IssueListType",
  "enum": [
    "issues",
    "dependencies"
  ],
  "type": "string",
  "description": "An enumeration."
}
```

### #/components/schemas/IssueReferenceRead

```ts
{
  id: string
  // An enumeration.
  type: enum[pull_request, external_github_pull_request, external_github_commit]
  payload: Partial(#/components/schemas/PullRequestReference) & Partial(#/components/schemas/ExternalGitHubPullRequestReference) & Partial(#/components/schemas/ExternalGitHubCommitReference)
  pullRequestReference: {
    id: string
    title: string
    author_login: string
    author_avatar: string
    number: integer
    additions: integer
    deletions: integer
    state: string
    created_at: string
    merged_at?: string
    closed_at?: string
    is_draft: boolean
  }
  externalGitHubPullRequestReference: {
    title: string
    author_login: string
    author_avatar: string
    number: integer
    organization_name: string
    repository_name: string
    state: string
  }
  externalGitHubCommitReference: {
    author_login: string
    author_avatar: string
    sha: string
    organization_name: string
    repository_name: string
    branch_name?: string
    message?: string
  }
}
```

### #/components/schemas/IssueReferenceType

```ts
{
  "title": "IssueReferenceType",
  "enum": [
    "pull_request",
    "external_github_pull_request",
    "external_github_commit"
  ],
  "type": "string",
  "description": "An enumeration."
}
```

### #/components/schemas/IssueSortBy

```ts
{
  "title": "IssueSortBy",
  "enum": [
    "newest",
    "recently_updated",
    "least_recently_updated",
    "pledged_amount_desc",
    "relevance",
    "dependencies_default",
    "issues_default",
    "most_engagement",
    "most_positive_reactions",
    "funding_goal_desc_and_most_positive_reactions"
  ],
  "type": "string",
  "description": "An enumeration."
}
```

### #/components/schemas/IssueStatus

```ts
{
  "title": "IssueStatus",
  "enum": [
    "backlog",
    "triaged",
    "in_progress",
    "pull_request",
    "closed",
    "building"
  ],
  "type": "string",
  "description": "An enumeration."
}
```

### #/components/schemas/IssueUpdateBadgeMessage

```ts
{
  message: string
}
```

### #/components/schemas/Label

```ts
{
  name: string
  color: string
}
```

### #/components/schemas/ListFundingSortBy

```ts
{
  "title": "ListFundingSortBy",
  "enum": [
    "oldest",
    "newest",
    "most_funded",
    "most_engagement"
  ],
  "type": "string",
  "description": "An enumeration."
}
```

### #/components/schemas/ListResource_Account_

```ts
{
  items: {
    id: string
    // An enumeration.
    account_type: enum[stripe, open_collective]
    stripe_id?: string
    open_collective_slug?: string
    is_details_submitted?: boolean
    country: string
  }[]
  pagination: {
    total_count: integer
    max_page: integer
  }
}
```

### #/components/schemas/ListResource_BackofficeReward_

```ts
{
  items: {
    // The pledge that the reward was split from
    pledge: #/components/schemas/Pledge
    // The user that received the reward (if any)
    user?: #/components/schemas/User
    // The organization that received the reward (if any)
    organization?: #/components/schemas/Organization
    amount: {
      // Three letter currency code (eg: USD)
      currency: string
      // Amount in the currencys smallest unit (cents if currency is USD)
      amount: integer
    }
    // An enumeration.
    state: enum[pending, paid]
    // If and when the reward was paid out.
    paid_at?: string
    transfer_id?: string
    issue_reward_id: string
    pledge_payment_id?: string
    pledger_email?: string
  }[]
  pagination: {
    total_count: integer
    max_page: integer
  }
}
```

### #/components/schemas/ListResource_IssueFunding_

```ts
{
  items: {
    issue: {
      id: string
      // Issue platform (currently always GitHub)
      platform: #/components/schemas/Platforms
      // GitHub #number
      number: integer
      // GitHub issue title
      title: string
      // GitHub issue body
      body?: string
      // Number of GitHub comments made on the issue
      comments?: integer
      labels: {
        name: string
        color: string
      }[]
      // GitHub author
      author?: #/components/schemas/Author
      assignees: {
        id: integer
        login: string
        html_url: string
        avatar_url: string
      }[]
      // GitHub reactions
      reactions?: #/components/schemas/Reactions
      state: enum[OPEN, CLOSED]
      issue_closed_at?: string
      issue_modified_at?: string
      issue_created_at: string
      // If a maintainer needs to mark this issue as solved
      needs_confirmation_solved: boolean
      // If this issue has been marked as confirmed solved through Polar
      confirmed_solved_at?: string
      funding: {
        funding_goal: {
          // Three letter currency code (eg: USD)
          currency: string
          // Amount in the currencys smallest unit (cents if currency is USD)
          amount: integer
        }
        // Sum of pledges to this isuse (including currently open pledges and pledges that have been paid out). Always in USD.
        pledges_sum?: #/components/schemas/CurrencyAmount
      }
      // The repository that the issue is in
      repository: #/components/schemas/Repository
      // Share of rewrads that will be rewarded to contributors of this issue. A number between 0 and 100 (inclusive).
      upfront_split_to_contributors?: integer
      // If this issue currently has the Polar badge SVG embedded
      pledge_badge_currently_embedded: boolean
      // Optional custom badge SVG promotional content
      badge_custom_content?: string
    }
    funding_goal:#/components/schemas/CurrencyAmount
    total:#/components/schemas/CurrencyAmount
    pledges_summaries: {
      pay_upfront: {
        total:#/components/schemas/CurrencyAmount
        pledgers: {
          name: string
          github_username?: string
          avatar_url?: string
        }[]
      }
      pay_on_completion:#/components/schemas/PledgesSummary
      pay_directly:#/components/schemas/PledgesSummary
    }
  }[]
  pagination: {
    total_count: integer
    max_page: integer
  }
}
```

### #/components/schemas/ListResource_Issue_

```ts
{
  items: {
    id: string
    // Issue platform (currently always GitHub)
    platform: #/components/schemas/Platforms
    // GitHub #number
    number: integer
    // GitHub issue title
    title: string
    // GitHub issue body
    body?: string
    // Number of GitHub comments made on the issue
    comments?: integer
    labels: {
      name: string
      color: string
    }[]
    // GitHub author
    author?: #/components/schemas/Author
    assignees: {
      id: integer
      login: string
      html_url: string
      avatar_url: string
    }[]
    // GitHub reactions
    reactions?: #/components/schemas/Reactions
    state: enum[OPEN, CLOSED]
    issue_closed_at?: string
    issue_modified_at?: string
    issue_created_at: string
    // If a maintainer needs to mark this issue as solved
    needs_confirmation_solved: boolean
    // If this issue has been marked as confirmed solved through Polar
    confirmed_solved_at?: string
    funding: {
      funding_goal: {
        // Three letter currency code (eg: USD)
        currency: string
        // Amount in the currencys smallest unit (cents if currency is USD)
        amount: integer
      }
      // Sum of pledges to this isuse (including currently open pledges and pledges that have been paid out). Always in USD.
      pledges_sum?: #/components/schemas/CurrencyAmount
    }
    // The repository that the issue is in
    repository: #/components/schemas/Repository
    // Share of rewrads that will be rewarded to contributors of this issue. A number between 0 and 100 (inclusive).
    upfront_split_to_contributors?: integer
    // If this issue currently has the Polar badge SVG embedded
    pledge_badge_currently_embedded: boolean
    // Optional custom badge SVG promotional content
    badge_custom_content?: string
  }[]
  pagination: {
    total_count: integer
    max_page: integer
  }
}
```

### #/components/schemas/ListResource_Organization_

```ts
{
  items: {
    id: string
    // An enumeration.
    platform: enum[github]
    name: string
    avatar_url: string
    bio?: string
    pretty_name?: string
    company?: string
    blog?: string
    location?: string
    email?: string
    twitter_username?: string
    pledge_minimum_amount: integer
    pledge_badge_show_amount: boolean
  }[]
  pagination: {
    total_count: integer
    max_page: integer
  }
}
```

### #/components/schemas/ListResource_PaymentMethod_

```ts
{
  items: {
    stripe_payment_method_id: string
    type: enum[card]
    brand?: string
    last4: string
    exp_month: integer
    exp_year: integer
  }[]
  pagination: {
    total_count: integer
    max_page: integer
  }
}
```

### #/components/schemas/ListResource_PersonalAccessToken_

```ts
{
  items: {
    id: string
    created_at: string
    last_used_at?: string
    expires_at: string
    comment: string
  }[]
  pagination: {
    total_count: integer
    max_page: integer
  }
}
```

### #/components/schemas/ListResource_Pledge_

```ts
{
  items: {
    // Pledge ID
    id: string
    // When the pledge was created
    created_at: string
    // Amount pledged towards the issue
    amount: #/components/schemas/CurrencyAmount
    // Current state of the pledge
    state: #/components/schemas/PledgeState
    // Type of pledge
    type: #/components/schemas/PledgeType
    // If and when the pledge was refunded to the pledger
    refunded_at?: string
    // When the payout is scheduled to be made to the maintainers behind the issue. Disputes must be made before this date.
    scheduled_payout_at?: string
    // The issue that the pledge was made towards
    issue: #/components/schemas/Issue
    // The user or organization that made this pledge
    pledger?: #/components/schemas/Pledger
    // URL of invoice for this pledge
    hosted_invoice_url?: string
    // If the currently authenticated subject can perform admin actions on behalf of the maker of the peldge
    authed_can_admin_sender?: boolean
    // If the currently authenticated subject can perform admin actions on behalf of the receiver of the peldge
    authed_can_admin_received?: boolean
  }[]
  pagination: {
    total_count: integer
    max_page: integer
  }
}
```

### #/components/schemas/ListResource_PullRequest_

```ts
{
  items: {
    id: string
    number: integer
    title: string
    author: {
      id: integer
      login: string
      html_url: string
      avatar_url: string
    }
    additions: integer
    deletions: integer
    is_merged: boolean
    is_closed: boolean
  }[]
  pagination: {
    total_count: integer
    max_page: integer
  }
}
```

### #/components/schemas/ListResource_Repository_

```ts
{
  items: {
    id: string
    // An enumeration.
    platform: enum[github]
    // An enumeration.
    visibility: enum[public, private]
    name: string
    description?: string
    stars?: integer
    license?: string
    homepage?: string
    organization: {
      id: string
      platform:#/components/schemas/Platforms
      name: string
      avatar_url: string
      bio?: string
      pretty_name?: string
      company?: string
      blog?: string
      location?: string
      email?: string
      twitter_username?: string
      pledge_minimum_amount: integer
      pledge_badge_show_amount: boolean
    }
  }[]
  pagination: {
    total_count: integer
    max_page: integer
  }
}
```

### #/components/schemas/ListResource_Reward_

```ts
{
  items: {
    // The pledge that the reward was split from
    pledge: #/components/schemas/Pledge
    // The user that received the reward (if any)
    user?: #/components/schemas/User
    // The organization that received the reward (if any)
    organization?: #/components/schemas/Organization
    amount: {
      // Three letter currency code (eg: USD)
      currency: string
      // Amount in the currencys smallest unit (cents if currency is USD)
      amount: integer
    }
    // An enumeration.
    state: enum[pending, paid]
    // If and when the reward was paid out.
    paid_at?: string
  }[]
  pagination: {
    total_count: integer
    max_page: integer
  }
}
```

### #/components/schemas/LoginResponse

```ts
{
  success: boolean
  expires_at: string
  token?: string
  goto_url?: string
}
```

### #/components/schemas/LogoutResponse

```ts
{
  success: boolean
}
```

### #/components/schemas/LookupUserRequest

```ts
{
  username: string
}
```

### #/components/schemas/MagicLinkRequest

```ts
{
  email: string
}
```

### #/components/schemas/MaintainerPledgeConfirmationPendingNotification

```ts
{
  pledger_name: string
  pledge_amount: string
  issue_url: string
  issue_title: string
  issue_org_name: string
  issue_repo_name: string
  issue_number: integer
  maintainer_has_stripe_account: boolean
  pledge_id?: string
}
```

### #/components/schemas/MaintainerPledgeCreatedNotification

```ts
{
  pledger_name: string
  pledge_amount: string
  issue_url: string
  issue_title: string
  issue_org_name: string
  issue_repo_name: string
  issue_number: integer
  maintainer_has_stripe_account: boolean
  pledge_id?: string
}
```

### #/components/schemas/MaintainerPledgePaidNotification

```ts
{
  paid_out_amount: string
  issue_url: string
  issue_title: string
  issue_org_name: string
  issue_repo_name: string
  issue_number: integer
  pledge_id?: string
}
```

### #/components/schemas/MaintainerPledgePendingNotification

```ts
{
  pledger_name: string
  pledge_amount: string
  issue_url: string
  issue_title: string
  issue_org_name: string
  issue_repo_name: string
  issue_number: integer
  maintainer_has_stripe_account: boolean
  pledge_id?: string
}
```

### #/components/schemas/MaintainerPledgedIssueConfirmationPendingNotification

```ts
{
  pledge_amount_sum: string
  issue_id: string
  issue_url: string
  issue_title: string
  issue_org_name: string
  issue_repo_name: string
  issue_number: integer
  maintainer_has_account: boolean
}
```

### #/components/schemas/MaintainerPledgedIssuePendingNotification

```ts
{
  pledge_amount_sum: string
  issue_id: string
  issue_url: string
  issue_title: string
  issue_org_name: string
  issue_repo_name: string
  issue_number: integer
  maintainer_has_account: boolean
}
```

### #/components/schemas/NotificationRead

```ts
{
  id: string
  // An enumeration.
  type: enum[MaintainerPledgePaidNotification, MaintainerPledgeConfirmationPendingNotification, MaintainerPledgePendingNotification, MaintainerPledgeCreatedNotification, PledgerPledgePendingNotification, RewardPaidNotification, MaintainerPledgedIssueConfirmationPendingNotification, MaintainerPledgedIssuePendingNotification]
  created_at: string
  payload: Partial(#/components/schemas/MaintainerPledgePaidNotification) & Partial(#/components/schemas/MaintainerPledgeConfirmationPendingNotification) & Partial(#/components/schemas/MaintainerPledgePendingNotification) & Partial(#/components/schemas/MaintainerPledgeCreatedNotification) & Partial(#/components/schemas/PledgerPledgePendingNotification) & Partial(#/components/schemas/RewardPaidNotification) & Partial(#/components/schemas/MaintainerPledgedIssueConfirmationPendingNotification) & Partial(#/components/schemas/MaintainerPledgedIssuePendingNotification)
  maintainerPledgePaid: {
    paid_out_amount: string
    issue_url: string
    issue_title: string
    issue_org_name: string
    issue_repo_name: string
    issue_number: integer
    pledge_id?: string
  }
  maintainerPledgeConfirmationPending: {
    pledger_name: string
    pledge_amount: string
    issue_url: string
    issue_title: string
    issue_org_name: string
    issue_repo_name: string
    issue_number: integer
    maintainer_has_stripe_account: boolean
    pledge_id?: string
  }
  maintainerPledgePending: {
    pledger_name: string
    pledge_amount: string
    issue_url: string
    issue_title: string
    issue_org_name: string
    issue_repo_name: string
    issue_number: integer
    maintainer_has_stripe_account: boolean
    pledge_id?: string
  }
  maintainerPledgeCreated: {
    pledger_name: string
    pledge_amount: string
    issue_url: string
    issue_title: string
    issue_org_name: string
    issue_repo_name: string
    issue_number: integer
    maintainer_has_stripe_account: boolean
    pledge_id?: string
  }
  pledgerPledgePending: {
    pledge_amount: string
    issue_url: string
    issue_title: string
    issue_number: integer
    issue_org_name: string
    issue_repo_name: string
    pledge_date: string
    pledge_id?: string
    // An enumeration.
    pledge_type?: enum[pay_upfront, pay_on_completion, pay_directly]
  }
  rewardPaid: {
    paid_out_amount: string
    issue_url: string
    issue_title: string
    issue_org_name: string
    issue_repo_name: string
    issue_number: integer
    issue_id: string
    pledge_id: string
  }
  maintainerPledgedIssueConfirmationPending: {
    pledge_amount_sum: string
    issue_id: string
    issue_url: string
    issue_title: string
    issue_org_name: string
    issue_repo_name: string
    issue_number: integer
    maintainer_has_account: boolean
  }
  maintainerPledgedIssuePending: {
    pledge_amount_sum: string
    issue_id: string
    issue_url: string
    issue_title: string
    issue_org_name: string
    issue_repo_name: string
    issue_number: integer
    maintainer_has_account: boolean
  }
}
```

### #/components/schemas/NotificationType

```ts
{
  "title": "NotificationType",
  "enum": [
    "MaintainerPledgePaidNotification",
    "MaintainerPledgeConfirmationPendingNotification",
    "MaintainerPledgePendingNotification",
    "MaintainerPledgeCreatedNotification",
    "PledgerPledgePendingNotification",
    "RewardPaidNotification",
    "MaintainerPledgedIssueConfirmationPendingNotification",
    "MaintainerPledgedIssuePendingNotification"
  ],
  "type": "string",
  "description": "An enumeration."
}
```

### #/components/schemas/NotificationsList

```ts
{
  notifications: {
    id: string
    // An enumeration.
    type: enum[MaintainerPledgePaidNotification, MaintainerPledgeConfirmationPendingNotification, MaintainerPledgePendingNotification, MaintainerPledgeCreatedNotification, PledgerPledgePendingNotification, RewardPaidNotification, MaintainerPledgedIssueConfirmationPendingNotification, MaintainerPledgedIssuePendingNotification]
    created_at: string
    payload: Partial(#/components/schemas/MaintainerPledgePaidNotification) & Partial(#/components/schemas/MaintainerPledgeConfirmationPendingNotification) & Partial(#/components/schemas/MaintainerPledgePendingNotification) & Partial(#/components/schemas/MaintainerPledgeCreatedNotification) & Partial(#/components/schemas/PledgerPledgePendingNotification) & Partial(#/components/schemas/RewardPaidNotification) & Partial(#/components/schemas/MaintainerPledgedIssueConfirmationPendingNotification) & Partial(#/components/schemas/MaintainerPledgedIssuePendingNotification)
    maintainerPledgePaid: {
      paid_out_amount: string
      issue_url: string
      issue_title: string
      issue_org_name: string
      issue_repo_name: string
      issue_number: integer
      pledge_id?: string
    }
    maintainerPledgeConfirmationPending: {
      pledger_name: string
      pledge_amount: string
      issue_url: string
      issue_title: string
      issue_org_name: string
      issue_repo_name: string
      issue_number: integer
      maintainer_has_stripe_account: boolean
      pledge_id?: string
    }
    maintainerPledgePending: {
      pledger_name: string
      pledge_amount: string
      issue_url: string
      issue_title: string
      issue_org_name: string
      issue_repo_name: string
      issue_number: integer
      maintainer_has_stripe_account: boolean
      pledge_id?: string
    }
    maintainerPledgeCreated: {
      pledger_name: string
      pledge_amount: string
      issue_url: string
      issue_title: string
      issue_org_name: string
      issue_repo_name: string
      issue_number: integer
      maintainer_has_stripe_account: boolean
      pledge_id?: string
    }
    pledgerPledgePending: {
      pledge_amount: string
      issue_url: string
      issue_title: string
      issue_number: integer
      issue_org_name: string
      issue_repo_name: string
      pledge_date: string
      pledge_id?: string
      // An enumeration.
      pledge_type?: enum[pay_upfront, pay_on_completion, pay_directly]
    }
    rewardPaid: {
      paid_out_amount: string
      issue_url: string
      issue_title: string
      issue_org_name: string
      issue_repo_name: string
      issue_number: integer
      issue_id: string
      pledge_id: string
    }
    maintainerPledgedIssueConfirmationPending: {
      pledge_amount_sum: string
      issue_id: string
      issue_url: string
      issue_title: string
      issue_org_name: string
      issue_repo_name: string
      issue_number: integer
      maintainer_has_account: boolean
    }
    maintainerPledgedIssuePending: {
      pledge_amount_sum: string
      issue_id: string
      issue_url: string
      issue_title: string
      issue_org_name: string
      issue_repo_name: string
      issue_number: integer
      maintainer_has_account: boolean
    }
  }[]
  last_read_notification_id?: string
}
```

### #/components/schemas/NotificationsMarkRead

```ts
{
  notification_id: string
}
```

### #/components/schemas/OAuthAccountRead

```ts
{
  created_at: string
  modified_at?: string
  // An enumeration.
  platform: enum[github]
  account_id: string
  account_email: string
}
```

### #/components/schemas/Organization

```ts
{
  id: string
  // An enumeration.
  platform: enum[github]
  name: string
  avatar_url: string
  bio?: string
  pretty_name?: string
  company?: string
  blog?: string
  location?: string
  email?: string
  twitter_username?: string
  pledge_minimum_amount: integer
  pledge_badge_show_amount: boolean
}
```

### #/components/schemas/OrganizationBadgeSettingsRead

```ts
{
  show_amount: boolean
  minimum_amount: integer
  message?: string
  repositories: {
    id: string
    avatar_url?: string
    name: string
    synced_issues: integer
    open_issues: integer
    auto_embedded_issues: integer
    label_embedded_issues: integer
    pull_requests: integer
    badge_auto_embed: boolean
    badge_label: string
    is_private: boolean
    is_sync_completed: boolean
  }[]
}
```

### #/components/schemas/OrganizationBadgeSettingsUpdate

```ts
{
  show_amount: boolean
  minimum_amount: integer
  message: string
  repositories: {
    id: string
    badge_auto_embed: boolean
    retroactive: boolean
  }[]
}
```

### #/components/schemas/OrganizationPrivateRead

```ts
{
  pledge_badge_show_amount?: boolean //default: true
  billing_email?: string
  // An enumeration.
  platform: enum[github]
  name: string
  avatar_url: string
  external_id: integer
  is_personal: boolean
  installation_id?: integer
  installation_created_at?: string
  installation_updated_at?: string
  installation_suspended_at?: string
  onboarded_at?: string
  pledge_minimum_amount: integer
  default_badge_custom_content?: string
  id: string
  created_at: string
  modified_at?: string
  repositories: {
    id: string
    platform:#/components/schemas/Platforms
    // An enumeration.
    visibility: enum[public, private]
    name: string
    description?: string
    stars?: integer
    license?: string
    homepage?: string
  }[]
}
```

### #/components/schemas/Pagination

```ts
{
  total_count: integer
  max_page: integer
}
```

### #/components/schemas/PaginationResponse

```ts
{
  total_count: integer
  page: integer
  next_page?: integer
}
```

### #/components/schemas/PaymentMethod

```ts
{
  stripe_payment_method_id: string
  type: enum[card]
  brand?: string
  last4: string
  exp_month: integer
  exp_year: integer
}
```

### #/components/schemas/PersonalAccessToken

```ts
{
  id: string
  created_at: string
  last_used_at?: string
  expires_at: string
  comment: string
}
```

### #/components/schemas/Platforms

```ts
{
  "title": "Platforms",
  "enum": [
    "github"
  ],
  "type": "string",
  "description": "An enumeration."
}
```

### #/components/schemas/Pledge

```ts
{
  // Pledge ID
  id: string
  // When the pledge was created
  created_at: string
  // Amount pledged towards the issue
  amount: #/components/schemas/CurrencyAmount
  // Current state of the pledge
  state: #/components/schemas/PledgeState
  // Type of pledge
  type: #/components/schemas/PledgeType
  // If and when the pledge was refunded to the pledger
  refunded_at?: string
  // When the payout is scheduled to be made to the maintainers behind the issue. Disputes must be made before this date.
  scheduled_payout_at?: string
  // The issue that the pledge was made towards
  issue: #/components/schemas/Issue
  // The user or organization that made this pledge
  pledger?: #/components/schemas/Pledger
  // URL of invoice for this pledge
  hosted_invoice_url?: string
  // If the currently authenticated subject can perform admin actions on behalf of the maker of the peldge
  authed_can_admin_sender?: boolean
  // If the currently authenticated subject can perform admin actions on behalf of the receiver of the peldge
  authed_can_admin_received?: boolean
}
```

### #/components/schemas/PledgePledgesSummary

```ts
{
  funding: {
    funding_goal: {
      // Three letter currency code (eg: USD)
      currency: string
      // Amount in the currencys smallest unit (cents if currency is USD)
      amount: integer
    }
    // Sum of pledges to this isuse (including currently open pledges and pledges that have been paid out). Always in USD.
    pledges_sum?: #/components/schemas/CurrencyAmount
  }
  pledges: {
    // Type of pledge
    type: #/components/schemas/PledgeType
    pledger: {
      name: string
      github_username?: string
      avatar_url?: string
    }
  }[]
}
```

### #/components/schemas/PledgeRewardTransfer

```ts
{
  pledge_id: string
  issue_reward_id: string
}
```

### #/components/schemas/PledgeState

```ts
{
  "title": "PledgeState",
  "enum": [
    "initiated",
    "created",
    "pending",
    "refunded",
    "disputed",
    "charge_disputed"
  ],
  "type": "string",
  "description": "An enumeration."
}
```

### #/components/schemas/PledgeStripePaymentIntentCreate

```ts
{
  issue_id: string
  email: string
  amount: integer
  setup_future_usage?: enum[on_session]
}
```

### #/components/schemas/PledgeStripePaymentIntentMutationResponse

```ts
{
  payment_intent_id: string
  amount: integer
  fee: integer
  amount_including_fee: integer
  client_secret?: string
}
```

### #/components/schemas/PledgeStripePaymentIntentUpdate

```ts
{
  email: string
  amount: integer
  setup_future_usage?: enum[on_session]
}
```

### #/components/schemas/PledgeType

```ts
{
  "title": "PledgeType",
  "enum": [
    "pay_upfront",
    "pay_on_completion",
    "pay_directly"
  ],
  "type": "string",
  "description": "An enumeration."
}
```

### #/components/schemas/Pledger

```ts
{
  name: string
  github_username?: string
  avatar_url?: string
}
```

### #/components/schemas/PledgerPledgePendingNotification

```ts
{
  pledge_amount: string
  issue_url: string
  issue_title: string
  issue_number: integer
  issue_org_name: string
  issue_repo_name: string
  pledge_date: string
  pledge_id?: string
  // An enumeration.
  pledge_type?: enum[pay_upfront, pay_on_completion, pay_directly]
}
```

### #/components/schemas/PledgesSummary

```ts
{
  total: {
    // Three letter currency code (eg: USD)
    currency: string
    // Amount in the currencys smallest unit (cents if currency is USD)
    amount: integer
  }
  pledgers: {
    name: string
    github_username?: string
    avatar_url?: string
  }[]
}
```

### #/components/schemas/PledgesTypeSummaries

```ts
{
  pay_upfront: {
    total: {
      // Three letter currency code (eg: USD)
      currency: string
      // Amount in the currencys smallest unit (cents if currency is USD)
      amount: integer
    }
    pledgers: {
      name: string
      github_username?: string
      avatar_url?: string
    }[]
  }
  pay_on_completion:#/components/schemas/PledgesSummary
  pay_directly:#/components/schemas/PledgesSummary
}
```

### #/components/schemas/PostIssueComment

```ts
{
  message: string
  append_badge?: boolean
}
```

### #/components/schemas/PullRequest

```ts
{
  id: string
  number: integer
  title: string
  author: {
    id: integer
    login: string
    html_url: string
    avatar_url: string
  }
  additions: integer
  deletions: integer
  is_merged: boolean
  is_closed: boolean
}
```

### #/components/schemas/PullRequestReference

```ts
{
  id: string
  title: string
  author_login: string
  author_avatar: string
  number: integer
  additions: integer
  deletions: integer
  state: string
  created_at: string
  merged_at?: string
  closed_at?: string
  is_draft: boolean
}
```

### #/components/schemas/Reactions

```ts
{
  total_count: integer
  plus_one: integer
  minus_one: integer
  laugh: integer
  hooray: integer
  confused: integer
  heart: integer
  rocket: integer
  eyes: integer
}
```

### #/components/schemas/Relationship

```ts
{
  data: Partial(#/components/schemas/RelationshipData) & Partial({
     type: string
     id: Partial(string) & Partial(string)
   }[])
}
```

### #/components/schemas/RelationshipData

```ts
{
  type: string
  id: Partial(string) & Partial(string)
}
```

### #/components/schemas/Repository

```ts
{
  id: string
  // An enumeration.
  platform: enum[github]
  // An enumeration.
  visibility: enum[public, private]
  name: string
  description?: string
  stars?: integer
  license?: string
  homepage?: string
  organization: {
    id: string
    platform:#/components/schemas/Platforms
    name: string
    avatar_url: string
    bio?: string
    pretty_name?: string
    company?: string
    blog?: string
    location?: string
    email?: string
    twitter_username?: string
    pledge_minimum_amount: integer
    pledge_badge_show_amount: boolean
  }
}
```

### #/components/schemas/RepositoryBadgeSettingsRead

```ts
{
  id: string
  avatar_url?: string
  name: string
  synced_issues: integer
  open_issues: integer
  auto_embedded_issues: integer
  label_embedded_issues: integer
  pull_requests: integer
  badge_auto_embed: boolean
  badge_label: string
  is_private: boolean
  is_sync_completed: boolean
}
```

### #/components/schemas/RepositoryBadgeSettingsUpdate

```ts
{
  id: string
  badge_auto_embed: boolean
  retroactive: boolean
}
```

### #/components/schemas/RepositoryLegacyRead

```ts
{
  id: string
  // An enumeration.
  platform: enum[github]
  // An enumeration.
  visibility: enum[public, private]
  name: string
  description?: string
  stars?: integer
  license?: string
  homepage?: string
}
```

### #/components/schemas/Reward

```ts
{
  // The pledge that the reward was split from
  pledge: #/components/schemas/Pledge
  // The user that received the reward (if any)
  user?: #/components/schemas/User
  // The organization that received the reward (if any)
  organization?: #/components/schemas/Organization
  amount: {
    // Three letter currency code (eg: USD)
    currency: string
    // Amount in the currencys smallest unit (cents if currency is USD)
    amount: integer
  }
  // An enumeration.
  state: enum[pending, paid]
  // If and when the reward was paid out.
  paid_at?: string
}
```

### #/components/schemas/RewardPaidNotification

```ts
{
  paid_out_amount: string
  issue_url: string
  issue_title: string
  issue_org_name: string
  issue_repo_name: string
  issue_number: integer
  issue_id: string
  pledge_id: string
}
```

### #/components/schemas/RewardState

```ts
{
  "title": "RewardState",
  "enum": [
    "pending",
    "paid"
  ],
  "type": "string",
  "description": "An enumeration."
}
```

### #/components/schemas/RewardsSummary

```ts
{
  receivers: {
    name: string
    avatar_url?: string
  }[]
}
```

### #/components/schemas/RewardsSummaryReceiver

```ts
{
  name: string
  avatar_url?: string
}
```

### #/components/schemas/SummaryPledge

```ts
{
  // Type of pledge
  type: #/components/schemas/PledgeType
  pledger: {
    name: string
    github_username?: string
    avatar_url?: string
  }
}
```

### #/components/schemas/UpdateIssue

```ts
{
  funding_goal: {
    // Three letter currency code (eg: USD)
    currency: string
    // Amount in the currencys smallest unit (cents if currency is USD)
    amount: integer
  }
  upfront_split_to_contributors?: integer
  unset_upfront_split_to_contributors?: boolean
}
```

### #/components/schemas/User

```ts
{
  username: string
  avatar_url: string
}
```

### #/components/schemas/UserRead

```ts
{
  created_at: string
  modified_at?: string
  username: string
  email: string
  avatar_url?: string
  profile: {
  }
  id: string
  accepted_terms_of_service: boolean
  email_newsletters_and_changelogs: boolean
  email_promotions_and_events: boolean
  oauth_accounts: {
    created_at: string
    modified_at?: string
    // An enumeration.
    platform: enum[github]
    account_id: string
    account_email: string
  }[]
}
```

### #/components/schemas/UserSignupType

```ts
{
  "title": "UserSignupType",
  "enum": [
    "maintainer",
    "backer"
  ],
  "type": "string",
  "description": "An enumeration."
}
```

### #/components/schemas/UserStripePortalSession

```ts
{
  url: string
}
```

### #/components/schemas/UserUpdateSettings

```ts
{
  email_newsletters_and_changelogs?: boolean
  email_promotions_and_events?: boolean
}
```

### #/components/schemas/ValidationError

```ts
{
  loc?: Partial(string) & Partial(integer)[]
  msg: string
  type: string
}
```

### #/components/schemas/Visibility

```ts
{
  "title": "Visibility",
  "enum": [
    "public",
    "private"
  ],
  "type": "string",
  "description": "An enumeration."
}
```

### #/components/schemas/polar__integrations__github__endpoints__WebhookResponse

```ts
{
  success: boolean
  message?: string
  job_id?: string
}
```

### #/components/schemas/polar__integrations__stripe__endpoints__WebhookResponse

```ts
{
  success: boolean
  message?: string
  job_id?: string
}
```

### #/components/securitySchemes/HTTPBearer

```ts
{
  "type": "http",
  "description": "You can generate a **Personal Access Token** from your [settings](https://polar.sh/settings).",
  "scheme": "bearer"
}
```