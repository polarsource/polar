/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import {
  AccountsApi,
  BackofficeApi,
  Configuration,
  DashboardApi,
  ExtensionApi,
  FundingApi,
  HealthApi,
  IntegrationsApi,
  IssuesApi,
  MagicLinkApi,
  NotificationsApi,
  OrganizationsApi,
  PaymentMethodsApi,
  PersonalAccessTokenApi,
  PledgesApi,
  PullRequestsApi,
  RepositoriesApi,
  RewardsApi,
  StreamApi,
  UsersApi,
} from '.'

export class PolarAPI {
  public readonly accounts: AccountsApi
  public readonly backoffice: BackofficeApi
  public readonly dashboard: DashboardApi
  public readonly extension: ExtensionApi
  public readonly funding: FundingApi
  public readonly health: HealthApi
  public readonly integrations: IntegrationsApi
  public readonly issues: IssuesApi
  public readonly magicLink: MagicLinkApi
  public readonly notifications: NotificationsApi
  public readonly organizations: OrganizationsApi
  public readonly paymentMethods: PaymentMethodsApi
  public readonly personalAccessToken: PersonalAccessTokenApi
  public readonly pledges: PledgesApi
  public readonly pullRequests: PullRequestsApi
  public readonly repositories: RepositoriesApi
  public readonly rewards: RewardsApi
  public readonly stream: StreamApi
  public readonly users: UsersApi

  constructor(config: Configuration) {
    // this.request = new HttpRequest({
    //   BASE: config?.BASE ?? 'https://api.polar.sh',
    //   VERSION: config?.VERSION ?? '0.1.0',
    //   WITH_CREDENTIALS: config?.WITH_CREDENTIALS ?? false,
    //   CREDENTIALS: config?.CREDENTIALS ?? 'include',
    //   TOKEN: config?.TOKEN,
    //   USERNAME: config?.USERNAME,
    //   PASSWORD: config?.PASSWORD,
    //   HEADERS: config?.HEADERS,
    //   ENCODE_PATH: config?.ENCODE_PATH,
    // })

    this.accounts = new AccountsApi(config)
    this.backoffice = new BackofficeApi(config)
    this.dashboard = new DashboardApi(config)
    this.extension = new ExtensionApi(config)
    this.funding = new FundingApi(config)
    this.health = new HealthApi(config)
    this.integrations = new IntegrationsApi(config)
    this.issues = new IssuesApi(config)
    this.magicLink = new MagicLinkApi(config)
    this.notifications = new NotificationsApi(config)
    this.organizations = new OrganizationsApi(config)
    this.paymentMethods = new PaymentMethodsApi(config)
    this.personalAccessToken = new PersonalAccessTokenApi(config)
    this.pledges = new PledgesApi(config)
    this.pullRequests = new PullRequestsApi(config)
    this.repositories = new RepositoriesApi(config)
    this.rewards = new RewardsApi(config)
    this.stream = new StreamApi(config)
    this.users = new UsersApi(config)
  }
}
