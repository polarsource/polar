/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BaseHttpRequest } from './core/BaseHttpRequest';
import type { OpenAPIConfig } from './core/OpenAPI';
import { AxiosHttpRequest } from './core/AxiosHttpRequest';

import { AccountsService } from './services/AccountsService';
import { BackofficeService } from './services/BackofficeService';
import { DashboardService } from './services/DashboardService';
import { IntegrationsService } from './services/IntegrationsService';
import { IssuesService } from './services/IssuesService';
import { NotificationsService } from './services/NotificationsService';
import { OrganizationsService } from './services/OrganizationsService';
import { PledgesService } from './services/PledgesService';
import { PullRequestsService } from './services/PullRequestsService';
import { StreamService } from './services/StreamService';
import { UserOrganizationsService } from './services/UserOrganizationsService';
import { UsersService } from './services/UsersService';

type HttpRequestConstructor = new (config: OpenAPIConfig) => BaseHttpRequest;

export class PolarAPI {

  public readonly accounts: AccountsService;
  public readonly backoffice: BackofficeService;
  public readonly dashboard: DashboardService;
  public readonly integrations: IntegrationsService;
  public readonly issues: IssuesService;
  public readonly notifications: NotificationsService;
  public readonly organizations: OrganizationsService;
  public readonly pledges: PledgesService;
  public readonly pullRequests: PullRequestsService;
  public readonly stream: StreamService;
  public readonly userOrganizations: UserOrganizationsService;
  public readonly users: UsersService;

  public readonly request: BaseHttpRequest;

  constructor(config?: Partial<OpenAPIConfig>, HttpRequest: HttpRequestConstructor = AxiosHttpRequest) {
    this.request = new HttpRequest({
      BASE: config?.BASE ?? '',
      VERSION: config?.VERSION ?? '0.1.0',
      WITH_CREDENTIALS: config?.WITH_CREDENTIALS ?? false,
      CREDENTIALS: config?.CREDENTIALS ?? 'include',
      TOKEN: config?.TOKEN,
      USERNAME: config?.USERNAME,
      PASSWORD: config?.PASSWORD,
      HEADERS: config?.HEADERS,
      ENCODE_PATH: config?.ENCODE_PATH,
    });

    this.accounts = new AccountsService(this.request);
    this.backoffice = new BackofficeService(this.request);
    this.dashboard = new DashboardService(this.request);
    this.integrations = new IntegrationsService(this.request);
    this.issues = new IssuesService(this.request);
    this.notifications = new NotificationsService(this.request);
    this.organizations = new OrganizationsService(this.request);
    this.pledges = new PledgesService(this.request);
    this.pullRequests = new PullRequestsService(this.request);
    this.stream = new StreamService(this.request);
    this.userOrganizations = new UserOrganizationsService(this.request);
    this.users = new UsersService(this.request);
  }
}

