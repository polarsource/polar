import {
  AccountsApi,
  AdvertisementsApi,
  ArticlesApi,
  AuthApi,
  BackofficeApi,
  BenefitsApi,
  CheckoutsApi,
  Configuration,
  DashboardApi,
  DonationsApi,
  ExternalOrganizationsApi,
  FilesApi,
  FundingApi,
  MetricsApi,
  IntegrationsDiscordApi,
  IntegrationsGithubApi,
  IntegrationsGithubRepositoryBenefitApi,
  IssuesApi,
  MagicLinkApi,
  NotificationsApi,
  Oauth2Api,
  OrdersApi,
  OrganizationsApi,
  PaymentMethodsApi,
  PersonalAccessTokenApi,
  PledgesApi,
  ProductsApi,
  PullRequestsApi,
  RepositoriesApi,
  RewardsApi,
  SubscriptionsApi,
  TrafficApi,
  TransactionsApi,
  UsersApi,
  WebhooksApi,
} from '.'

export class PolarAPI {
  public readonly accounts: AccountsApi
  public readonly advertisements: AdvertisementsApi
  public readonly articles: ArticlesApi
  public readonly auth: AuthApi
  public readonly backoffice: BackofficeApi
  public readonly checkouts: CheckoutsApi
  public readonly benefits: BenefitsApi
  public readonly dashboard: DashboardApi
  public readonly donations: DonationsApi
  public readonly externalOrganizations: ExternalOrganizationsApi
  public readonly funding: FundingApi
  public readonly integrationsDiscord: IntegrationsDiscordApi
  public readonly integrationsGitHub: IntegrationsGithubApi
  public readonly integrationsGitHubRepositoryBenefit: IntegrationsGithubRepositoryBenefitApi
  public readonly issues: IssuesApi
  public readonly magicLink: MagicLinkApi
  public readonly metrics: MetricsApi
  public readonly notifications: NotificationsApi
  public readonly oauth2: Oauth2Api
  public readonly orders: OrdersApi
  public readonly organizations: OrganizationsApi
  public readonly paymentMethods: PaymentMethodsApi
  public readonly personalAccessToken: PersonalAccessTokenApi
  public readonly pledges: PledgesApi
  public readonly products: ProductsApi
  public readonly pullRequests: PullRequestsApi
  public readonly repositories: RepositoriesApi
  public readonly rewards: RewardsApi
  public readonly subscriptions: SubscriptionsApi
  public readonly traffic: TrafficApi
  public readonly transactions: TransactionsApi
  public readonly users: UsersApi
  public readonly webhooks: WebhooksApi
  public readonly files: FilesApi

  constructor(config: Configuration) {
    this.accounts = new AccountsApi(config)
    this.advertisements = new AdvertisementsApi(config)
    this.articles = new ArticlesApi(config)
    this.auth = new AuthApi(config)
    this.backoffice = new BackofficeApi(config)
    this.checkouts = new CheckoutsApi(config)
    this.benefits = new BenefitsApi(config)
    this.dashboard = new DashboardApi(config)
    this.donations = new DonationsApi(config)
    this.externalOrganizations = new ExternalOrganizationsApi(config)
    this.funding = new FundingApi(config)
    this.integrationsDiscord = new IntegrationsDiscordApi(config)
    this.integrationsGitHub = new IntegrationsGithubApi(config)
    this.integrationsGitHubRepositoryBenefit =
      new IntegrationsGithubRepositoryBenefitApi(config)
    this.issues = new IssuesApi(config)
    this.magicLink = new MagicLinkApi(config)
    this.metrics = new MetricsApi(config)
    this.notifications = new NotificationsApi(config)
    this.oauth2 = new Oauth2Api(config)
    this.orders = new OrdersApi(config)
    this.organizations = new OrganizationsApi(config)
    this.paymentMethods = new PaymentMethodsApi(config)
    this.personalAccessToken = new PersonalAccessTokenApi(config)
    this.pledges = new PledgesApi(config)
    this.products = new ProductsApi(config)
    this.pullRequests = new PullRequestsApi(config)
    this.repositories = new RepositoriesApi(config)
    this.rewards = new RewardsApi(config)
    this.subscriptions = new SubscriptionsApi(config)
    this.traffic = new TrafficApi(config)
    this.transactions = new TransactionsApi(config)
    this.users = new UsersApi(config)
    this.webhooks = new WebhooksApi(config)
    this.files = new FilesApi(config)
  }
}
