from __future__ import annotations

import typing

from polar.base import AsyncServiceBase, SyncServiceBase

from .benefit_grants import BenefitGrantsAsync, BenefitGrantsSync
from .customer_meters import CustomerMetersAsync, CustomerMetersSync
from .customer_session import CustomerSessionAsync, CustomerSessionSync
from .customers import CustomersAsync, CustomersSync
from .downloadables import DownloadablesAsync, DownloadablesSync
from .license_keys import LicenseKeysAsync, LicenseKeysSync
from .members import MembersAsync, MembersSync
from .orders import OrdersAsync, OrdersSync
from .organizations import OrganizationsAsync, OrganizationsSync
from .seats import SeatsAsync, SeatsSync
from .subscriptions import SubscriptionsAsync, SubscriptionsSync
from .wallets import WalletsAsync, WalletsSync


class CustomerPortalSync(SyncServiceBase):
    benefit_grants: BenefitGrantsSync
    customers: CustomersSync
    customer_meters: CustomerMetersSync
    seats: SeatsSync
    customer_session: CustomerSessionSync
    downloadables: DownloadablesSync
    license_keys: LicenseKeysSync
    members: MembersSync
    orders: OrdersSync
    organizations: OrganizationsSync
    subscriptions: SubscriptionsSync
    wallets: WalletsSync

    def __init__(self, *args: typing.Any, **kwargs: typing.Any) -> None:
        super().__init__(*args, **kwargs)
        self.benefit_grants = BenefitGrantsSync.from_service(self)
        self.customers = CustomersSync.from_service(self)
        self.customer_meters = CustomerMetersSync.from_service(self)
        self.seats = SeatsSync.from_service(self)
        self.customer_session = CustomerSessionSync.from_service(self)
        self.downloadables = DownloadablesSync.from_service(self)
        self.license_keys = LicenseKeysSync.from_service(self)
        self.members = MembersSync.from_service(self)
        self.orders = OrdersSync.from_service(self)
        self.organizations = OrganizationsSync.from_service(self)
        self.subscriptions = SubscriptionsSync.from_service(self)
        self.wallets = WalletsSync.from_service(self)


class CustomerPortalAsync(AsyncServiceBase):
    benefit_grants: BenefitGrantsAsync
    customers: CustomersAsync
    customer_meters: CustomerMetersAsync
    seats: SeatsAsync
    customer_session: CustomerSessionAsync
    downloadables: DownloadablesAsync
    license_keys: LicenseKeysAsync
    members: MembersAsync
    orders: OrdersAsync
    organizations: OrganizationsAsync
    subscriptions: SubscriptionsAsync
    wallets: WalletsAsync

    def __init__(self, *args: typing.Any, **kwargs: typing.Any) -> None:
        super().__init__(*args, **kwargs)
        self.benefit_grants = BenefitGrantsAsync.from_service(self)
        self.customers = CustomersAsync.from_service(self)
        self.customer_meters = CustomerMetersAsync.from_service(self)
        self.seats = SeatsAsync.from_service(self)
        self.customer_session = CustomerSessionAsync.from_service(self)
        self.downloadables = DownloadablesAsync.from_service(self)
        self.license_keys = LicenseKeysAsync.from_service(self)
        self.members = MembersAsync.from_service(self)
        self.orders = OrdersAsync.from_service(self)
        self.organizations = OrganizationsAsync.from_service(self)
        self.subscriptions = SubscriptionsAsync.from_service(self)
        self.wallets = WalletsAsync.from_service(self)
