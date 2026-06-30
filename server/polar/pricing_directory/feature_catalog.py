from dataclasses import dataclass

from .schemas import FeatureCategory, FeatureKey


@dataclass(frozen=True)
class CatalogFeature:
    key: FeatureKey
    label: str
    category: FeatureCategory
    # True when the feature carries a meaningful value (storage, seats), as
    # opposed to a plain presence ("has SSO").
    quantitative: bool = False


# The canonical, comparable feature set. The extractor maps each plan's
# features into these; anything that doesn't fit goes to `other_features` for
# later catalog growth.
FEATURE_CATALOG: list[CatalogFeature] = [
    CatalogFeature(FeatureKey.sso, "Single sign-on (SSO)", FeatureCategory.access_control),
    CatalogFeature(FeatureKey.scim, "SCIM provisioning", FeatureCategory.access_control),
    CatalogFeature(FeatureKey.rbac, "Role-based access control", FeatureCategory.access_control),
    CatalogFeature(FeatureKey.mfa, "Two-factor / MFA", FeatureCategory.access_control),
    CatalogFeature(FeatureKey.audit_logs, "Audit logs", FeatureCategory.security_compliance),
    CatalogFeature(FeatureKey.soc2, "SOC 2", FeatureCategory.security_compliance),
    CatalogFeature(FeatureKey.hipaa, "HIPAA", FeatureCategory.security_compliance),
    CatalogFeature(FeatureKey.iso27001, "ISO 27001", FeatureCategory.security_compliance),
    CatalogFeature(FeatureKey.encryption, "Encryption / CMEK", FeatureCategory.security_compliance),
    CatalogFeature(FeatureKey.sla, "Uptime SLA", FeatureCategory.support),
    CatalogFeature(FeatureKey.priority_support, "Priority support", FeatureCategory.support),
    CatalogFeature(FeatureKey.dedicated_manager, "Dedicated account manager", FeatureCategory.support),
    CatalogFeature(FeatureKey.onboarding, "Onboarding / implementation", FeatureCategory.support),
    CatalogFeature(FeatureKey.self_hosted, "Self-hosted / on-prem", FeatureCategory.deployment),
    CatalogFeature(FeatureKey.private_cloud, "Private cloud / VPC", FeatureCategory.deployment),
    CatalogFeature(FeatureKey.multi_region, "Multi-region", FeatureCategory.deployment),
    CatalogFeature(FeatureKey.data_residency, "Data residency", FeatureCategory.data_privacy),
    CatalogFeature(FeatureKey.byok, "Bring your own key", FeatureCategory.data_privacy),
    CatalogFeature(FeatureKey.data_retention, "Data retention controls", FeatureCategory.data_privacy),
    CatalogFeature(FeatureKey.api_access, "API access", FeatureCategory.integrations),
    CatalogFeature(FeatureKey.webhooks, "Webhooks", FeatureCategory.integrations),
    CatalogFeature(FeatureKey.integrations, "Third-party integrations", FeatureCategory.integrations),
    CatalogFeature(FeatureKey.seats_included, "Included seats", FeatureCategory.collaboration, quantitative=True),
    CatalogFeature(FeatureKey.unlimited_seats, "Unlimited seats", FeatureCategory.collaboration),
    CatalogFeature(FeatureKey.guest_access, "Guest / external access", FeatureCategory.collaboration),
    CatalogFeature(FeatureKey.storage, "Storage", FeatureCategory.usage_limits, quantitative=True),
    CatalogFeature(FeatureKey.advanced_analytics, "Advanced analytics", FeatureCategory.analytics),
    CatalogFeature(FeatureKey.free_tier, "Free tier", FeatureCategory.administration),
    CatalogFeature(FeatureKey.free_trial, "Free trial", FeatureCategory.administration),
    CatalogFeature(FeatureKey.annual_discount, "Annual billing discount", FeatureCategory.administration),
    CatalogFeature(FeatureKey.invoicing, "Invoice billing", FeatureCategory.administration),
    CatalogFeature(FeatureKey.custom_branding, "Custom branding", FeatureCategory.customization),
]

CATALOG_BY_KEY: dict[FeatureKey, CatalogFeature] = {
    feature.key: feature for feature in FEATURE_CATALOG
}
