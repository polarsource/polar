import {
  AccountsApi,
  AdvertisementsApi,
  ArticlesApi,
  AuthApi,
  BackofficeApi,
  Configuration,
  DashboardApi,
  DonationsApi,
  ExtensionApi,
  FundingApi,
  HealthApi,
  IntegrationsDiscordApi,
  IntegrationsGithubApi,
  IntegrationsGithubRepositoryBenefitApi,
  IssuesApi,
  MagicLinkApi,
  NotificationsApi,
  OrganizationsApi,
  Oauth2Api,
  PaymentMethodsApi,
  PersonalAccessTokenApi,
  PledgesApi,
  PullRequestsApi,
  RepositoriesApi,
  RewardsApi,
  StreamApi,
  SubscriptionsApi,
  TrafficApi,
  TransactionsApi,
  UsersApi,
  WebhookNotificationsApi,
} from '.'

export class PolarAPI {
  public readonly accounts: AccountsApi
  public readonly advertisements: AdvertisementsApi
  public readonly articles: ArticlesApi
  public readonly auth: AuthApi
  public readonly backoffice: BackofficeApi
  public readonly dashboard: DashboardApi
  public readonly extension: ExtensionApi
  public readonly funding: FundingApi
  public readonly health: HealthApi
  public readonly integrationsDiscord: IntegrationsDiscordApi;
  public readonly integrationsGitHub: IntegrationsGithubApi;
  public readonly integrationsGitHubRepositoryBenefit: IntegrationsGithubRepositoryBenefitApi;
  public readonly issues: IssuesApi
  public readonly magicLink: MagicLinkApi
  public readonly notifications: NotificationsApi
  public readonly oauth2: Oauth2Api
  public readonly organizations: OrganizationsApi
  public readonly paymentMethods: PaymentMethodsApi
  public readonly personalAccessToken: PersonalAccessTokenApi
  public readonly pledges: PledgesApi
  public readonly pullRequests: PullRequestsApi
  public readonly repositories: RepositoriesApi
  public readonly rewards: RewardsApi
  public readonly stream: StreamApi
  public readonly subscriptions: SubscriptionsApi
  public readonly traffic: TrafficApi
  public readonly transactions: TransactionsApi
  public readonly users: UsersApi
  public readonly webhookNotifications: WebhookNotificationsApi
  public readonly donations: DonationsApi


  constructor(config: Configuration) {
    this.accounts = new AccountsApi(config)
    this.advertisements = new AdvertisementsApi(config)
    this.articles = new ArticlesApi(config)
    this.auth = new AuthApi(config)
    this.backoffice = new BackofficeApi(config)
    this.dashboard = new DashboardApi(config)
    this.extension = new ExtensionApi(config)
    this.funding = new FundingApi(config)
    this.health = new HealthApi(config)
    this.integrationsDiscord= new IntegrationsDiscordApi(config)
    this.integrationsGitHub= new IntegrationsGithubApi(config)
    this.integrationsGitHubRepositoryBenefit= new IntegrationsGithubRepositoryBenefitApi(config)
    this.issues = new IssuesApi(config)
    this.magicLink = new MagicLinkApi(config)
    this.notifications = new NotificationsApi(config)
    this.oauth2 = new Oauth2Api(config)
    this.organizations = new OrganizationsApi(config)
    this.paymentMethods = new PaymentMethodsApi(config)
    this.personalAccessToken = new PersonalAccessTokenApi(config)
    this.pledges = new PledgesApi(config)
    this.pullRequests = new PullRequestsApi(config)
    this.repositories = new RepositoriesApi(config)
    this.rewards = new RewardsApi(config)
    this.stream = new StreamApi(config)
    this.subscriptions = new SubscriptionsApi(config)
    this.traffic = new TrafficApi(config)
    this.transactions = new TransactionsApi(config)
    this.users = new UsersApi(config)
    this.webhookNotifications = new WebhookNotificationsApi(config)
    this.donations = new DonationsApi(config)
  }
}
