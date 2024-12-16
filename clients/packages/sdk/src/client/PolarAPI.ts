import {
  AccountsApi,
  AdvertisementsApi,
  AuthApi,
  BackofficeApi,
  BenefitsApi,
  CheckoutsApi,
  CheckoutsCustomApi,
  Configuration,
  DashboardApi,
  DiscountsApi,
  ExternalOrganizationsApi,
  FilesApi,
  FundingApi,
  MetricsApi,
  IntegrationsDiscordApi,
  IntegrationsGithubApi,
  IntegrationsGithubRepositoryBenefitApi,
  IssuesApi,
  MagicLinkApi,
  StorefrontsApi,
  CustomFieldsApi,
  NotificationsApi,
  Oauth2Api,
  Oauth2ClientsApi,
  OrdersApi,
  OrganizationsApi,
  PaymentMethodsApi,
  PersonalAccessTokenApi,
  PledgesApi,
  ProductsApi,
  RepositoriesApi,
  RewardsApi,
  SubscriptionsApi,
  TransactionsApi,
  UsersApi,
  WebhooksApi,
  LicenseKeysApi,
  CheckoutLinksApi,
  CustomerPortalBenefitGrantsApi,
  CustomerPortalCustomerSessionApi,
  CustomerPortalCustomersApi,
  CustomerPortalDownloadablesApi,
  CustomerPortalLicenseKeysApi,
  CustomerPortalOauthAccountsApi,
  CustomerPortalOrdersApi,
  CustomerPortalOrganizationsApi,
  CustomerPortalSubscriptionsApi,
  CustomersApi,
} from '.'

export class PolarAPI {
  public readonly accounts: AccountsApi
  public readonly advertisements: AdvertisementsApi
  public readonly auth: AuthApi
  public readonly backoffice: BackofficeApi
  public readonly customers: CustomersApi
  public readonly customerPortalBenefitGrants: CustomerPortalBenefitGrantsApi
  public readonly customerPortalCustomers: CustomerPortalCustomersApi
  public readonly customerPortalCustomerSession: CustomerPortalCustomerSessionApi
  public readonly customerPortalDownloadables: CustomerPortalDownloadablesApi
  public readonly customerPortalLicenseKeys: CustomerPortalLicenseKeysApi
  public readonly customerPortalOauthAccounts: CustomerPortalOauthAccountsApi
  public readonly customerPortalOrders: CustomerPortalOrdersApi
  public readonly customerPortalOrganizations: CustomerPortalOrganizationsApi
  public readonly customerPortalSubscriptions: CustomerPortalSubscriptionsApi
  public readonly legacyCheckouts: CheckoutsApi
  public readonly checkouts: CheckoutsCustomApi
  public readonly checkoutLinks: CheckoutLinksApi
  public readonly customFields: CustomFieldsApi
  public readonly discounts: DiscountsApi
  public readonly benefits: BenefitsApi
  public readonly dashboard: DashboardApi
  public readonly externalOrganizations: ExternalOrganizationsApi
  public readonly funding: FundingApi
  public readonly integrationsDiscord: IntegrationsDiscordApi
  public readonly integrationsGitHub: IntegrationsGithubApi
  public readonly integrationsGitHubRepositoryBenefit: IntegrationsGithubRepositoryBenefitApi
  public readonly issues: IssuesApi
  public readonly licenseKeys: LicenseKeysApi
  public readonly magicLink: MagicLinkApi
  public readonly metrics: MetricsApi
  public readonly notifications: NotificationsApi
  public readonly oauth2: Oauth2Api
  public readonly oauth2Clients: Oauth2ClientsApi
  public readonly orders: OrdersApi
  public readonly organizations: OrganizationsApi
  public readonly paymentMethods: PaymentMethodsApi
  public readonly personalAccessToken: PersonalAccessTokenApi
  public readonly pledges: PledgesApi
  public readonly products: ProductsApi
  public readonly repositories: RepositoriesApi
  public readonly rewards: RewardsApi
  public readonly storefronts: StorefrontsApi
  public readonly subscriptions: SubscriptionsApi
  public readonly transactions: TransactionsApi
  public readonly users: UsersApi
  public readonly webhooks: WebhooksApi
  public readonly files: FilesApi

  constructor(config: Configuration) {
    this.accounts = new AccountsApi(config)
    this.advertisements = new AdvertisementsApi(config)
    this.auth = new AuthApi(config)
    this.backoffice = new BackofficeApi(config)
    this.customers = new CustomersApi(config)
    this.customerPortalBenefitGrants = new CustomerPortalBenefitGrantsApi(config)
    this.customerPortalCustomers = new CustomerPortalCustomersApi(config)
    this.customerPortalCustomerSession = new CustomerPortalCustomerSessionApi(config)
    this.customerPortalDownloadables = new CustomerPortalDownloadablesApi(config)
    this.customerPortalLicenseKeys = new CustomerPortalLicenseKeysApi(config)
    this.customerPortalOauthAccounts = new CustomerPortalOauthAccountsApi(config)
    this.customerPortalOrders = new CustomerPortalOrdersApi(config)
    this.customerPortalOrganizations = new CustomerPortalOrganizationsApi(config)
    this.customerPortalSubscriptions = new CustomerPortalSubscriptionsApi(config)
    this.legacyCheckouts = new CheckoutsApi(config)
    this.checkouts = new CheckoutsCustomApi(config)
    this.checkoutLinks = new CheckoutLinksApi(config)
    this.customFields = new CustomFieldsApi(config)
    this.benefits = new BenefitsApi(config)
    this.dashboard = new DashboardApi(config)
    this.discounts = new DiscountsApi(config)
    this.externalOrganizations = new ExternalOrganizationsApi(config)
    this.funding = new FundingApi(config)
    this.integrationsDiscord = new IntegrationsDiscordApi(config)
    this.integrationsGitHub = new IntegrationsGithubApi(config)
    this.integrationsGitHubRepositoryBenefit =
      new IntegrationsGithubRepositoryBenefitApi(config)
    this.issues = new IssuesApi(config)
    this.licenseKeys = new LicenseKeysApi(config)
    this.magicLink = new MagicLinkApi(config)
    this.metrics = new MetricsApi(config)
    this.notifications = new NotificationsApi(config)
    this.oauth2 = new Oauth2Api(config)
    this.oauth2Clients = new Oauth2ClientsApi(config)
    this.orders = new OrdersApi(config)
    this.organizations = new OrganizationsApi(config)
    this.paymentMethods = new PaymentMethodsApi(config)
    this.personalAccessToken = new PersonalAccessTokenApi(config)
    this.pledges = new PledgesApi(config)
    this.products = new ProductsApi(config)
    this.repositories = new RepositoriesApi(config)
    this.rewards = new RewardsApi(config)
    this.storefronts = new StorefrontsApi(config)
    this.subscriptions = new SubscriptionsApi(config)
    this.transactions = new TransactionsApi(config)
    this.users = new UsersApi(config)
    this.webhooks = new WebhooksApi(config)
    this.files = new FilesApi(config)
  }
}
