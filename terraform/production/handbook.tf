locals {
  handbook_hostname = "handbook.polar.sh"
  handbook_zone_id  = "22bcd1b07ec25452aab472486bc8df94"

  handbook_redirects = {
    "/"                                                       = "https://linear.app/polarsh/document/engineering-handbook-438113df8882"
    "/engineering"                                            = "https://linear.app/polarsh/document/engineering-handbook-438113df8882"
    "/engineering/api-tokens-and-system-credentials"          = "https://linear.app/polarsh/document/api-tokens-and-system-credentials-2a24cc120e08"
    "/engineering/architecture-overview"                      = "https://linear.app/polarsh/document/architecture-overview-cb1ea3b55d72"
    "/engineering/backend-development/account-payout-account" = "https://linear.app/polarsh/document/account-and-payout-account-7422bf014685"
    "/engineering/backend-development/api-versioning"         = "https://linear.app/polarsh/document/api-versioning-875f1388daeb"
    "/engineering/backend-development/authorization"          = "https://linear.app/polarsh/document/authorization-4de95d9f6c43"
    "/engineering/backend-development/metadata"               = "https://linear.app/polarsh/document/metadata-d08fff8b2c38"
    "/engineering/backend-development/operational-errors"     = "https://linear.app/polarsh/document/operational-errors-f3231ad099c6"
    "/engineering/backend-development/rest-api-guidelines"    = "https://linear.app/polarsh/document/rest-api-guidelines-65841b9f4bcc"
    "/engineering/backend-development/task-debouncer"         = "https://linear.app/polarsh/document/task-debouncer-5183baad3d4c"
    "/engineering/backend-development/tinybird"               = "https://linear.app/polarsh/document/tinybird-e1d9400da2e9"
    "/engineering/data-flows"                                 = "https://linear.app/polarsh/document/data-flows-871cf7f4ea2f"
    "/engineering/database/ad-hoc-indices"                    = "https://linear.app/polarsh/document/ad-hoc-indices-1622b4525593"
    "/engineering/design-documents"                           = "https://linear.app/polarsh/document/design-documents-1b03e0f6e82b"
    "/engineering/design-documents/api-versioning"            = "https://linear.app/polarsh/document/api-versioning-4a4d04dff621"
    "/engineering/design-documents/business-entity"           = "https://linear.app/polarsh/document/business-entity-c3ce06f4ff7b"
    "/engineering/design-documents/event-storage"             = "https://linear.app/polarsh/document/event-storage-75da0a1b59c9"
    "/engineering/design-documents/index"                     = "https://linear.app/polarsh/document/design-documents-1b03e0f6e82b"
    "/engineering/design-documents/merchant-migrations"       = "https://linear.app/polarsh/document/merchant-migrations-to-polar-4bf093d64260"
    "/engineering/design-documents/multi-currency"            = "https://linear.app/polarsh/document/multi-currency-support-in-polar-1b20515b6a75"
    "/engineering/design-documents/outpost"                   = "https://linear.app/polarsh/document/outpost-6e56920d15a9"
    "/engineering/design-documents/payout-reviews"            = "https://linear.app/polarsh/document/payout-reviews-f502be39e4f1"
    "/engineering/design-documents/platform-api"              = "https://linear.app/polarsh/document/platform-api-ba28ce735c81"
    "/engineering/design-documents/polar-for-polar"           = "https://linear.app/polarsh/document/polar-for-polar-55ec49f50484"
    "/engineering/design-documents/prorations"                = "https://linear.app/polarsh/document/prorations-a33afe4a9736"
    "/engineering/design-documents/rbac"                      = "https://linear.app/polarsh/document/rbac-6bfb527b7c32"
    "/engineering/design-documents/receipts"                  = "https://linear.app/polarsh/document/receipts-d06d62642e25"
    "/engineering/design-documents/resend-forge"              = "https://linear.app/polarsh/document/switching-to-resend-forge-debd87215826"
    "/engineering/design-documents/seat-based-pricing"        = "https://linear.app/polarsh/document/seat-based-pricing-081eeaa1ec03"
    "/engineering/design-documents/secrets-encryption"        = "https://linear.app/polarsh/document/secrets-encryption-e53b64456f92"
    "/engineering/design-documents/subscription-retries"      = "https://linear.app/polarsh/document/subscription-retries-3d7f54339d2b"
    "/engineering/design-documents/tasks-on-lambda"           = "https://linear.app/polarsh/document/tasks-on-lambda-7d66491132f4"
    "/engineering/design-documents/template"                  = "https://linear.app/polarsh/document/design-document-template-02c5d83b61b2"
    "/engineering/design-documents/versioning"                = "https://linear.app/polarsh/document/versioning-1650ac3f8215"
    "/engineering/design-documents/wallets"                   = "https://linear.app/polarsh/document/wallets-1f63a71915c5"
    "/engineering/guides"                                     = "https://linear.app/polarsh/document/guides-c62ece0d9603"
    "/engineering/guides/cycle-admin"                         = "https://linear.app/polarsh/document/polar-cycle-67ec651893a6"
    "/engineering/guides/release-checkout"                    = "https://linear.app/polarsh/document/releasing-polar-shcheckout-f99ad5869065"
    "/engineering/introduction"                               = "https://linear.app/polarsh/document/engineering-at-polar-97be8ded96f6"
    "/engineering/oncall/connecting-to-prod-db"               = "https://linear.app/polarsh/document/connecting-to-the-database-cd9bb7563183"
    "/engineering/oncall/deploy-infra"                        = "https://linear.app/polarsh/document/deploy-infrastructure-changes-0fa2c1cb64d6"
    "/engineering/oncall/developer-faq"                       = "https://linear.app/polarsh/document/developer-faq-7f841e231b03"
    "/engineering/oncall/introduction"                        = "https://linear.app/polarsh/document/on-call-procedures-f8ea25b10fa2"
    "/engineering/oncall/kill-blocking-queries"               = "https://linear.app/polarsh/document/kill-blocking-db-queries-cad01282c6f0"
    "/engineering/oncall/merge-accounts"                      = "https://linear.app/polarsh/document/merge-accounts-08484072a987"
    "/engineering/oncall/respond-to-a-kms-compromise"         = "https://linear.app/polarsh/document/respond-to-a-kms-key-compromise-4640c8ddeb8c"
    "/engineering/oncall/rotate-db-credentials"               = "https://linear.app/polarsh/document/rotate-database-credentials-d40e4d450c6d"
    "/engineering/oncall/rotate-jwks"                         = "https://linear.app/polarsh/document/rotate-the-jwks-signing-key-d6aa154dd9a3"
    "/engineering/oncall/rotate-secret"                       = "https://linear.app/polarsh/document/rotate-the-token-hashing-secret-d3411952efbf"
    "/engineering/oncall/run-one-off-jobs"                    = "https://linear.app/polarsh/document/run-one-off-jobs-c229a8402092"
    "/engineering/oncall/trigger-webhooks"                    = "https://linear.app/polarsh/document/trigger-webhooks-69ee0b4dee46"
    "/engineering/oncall/vendor-security-monitoring"          = "https://linear.app/polarsh/document/vendor-security-monitoring-9d24c43e4288"
    "/engineering/rest-api-guidelines"                        = "https://linear.app/polarsh/document/rest-api-guidelines-65841b9f4bcc"
    "/engineering/tech-notes"                                 = "https://linear.app/polarsh/document/tech-notes-f96140836004"
    "/engineering/tech-notes/worker-memory-leak"              = "https://linear.app/polarsh/document/investigating-worker-memory-leak-in-polar-c6c636bc7160"
    "/engineering/tech-notes/worker-memory-leak-act-2"        = "https://linear.app/polarsh/document/worker-memory-leak-act-2-c46217507c9e"
  }

  handbook_redirect_paths = merge(local.handbook_redirects, {
    for path, destination in local.handbook_redirects : "${path}/" => destination if path != "/"
  })
}

data "cloudflare_zone" "handbook" {
  zone_id = local.handbook_zone_id
}

data "cloudflare_rulesets" "handbook_account" {
  account_id = data.cloudflare_zone.handbook.account.id
}

resource "cloudflare_list" "handbook_redirects" {
  account_id  = data.cloudflare_zone.handbook.account.id
  name        = "polar_handbook_redirects"
  description = "Legacy Polar handbook URLs"
  kind        = "redirect"

  items = [
    for path, destination in local.handbook_redirect_paths : {
      redirect = {
        source_url            = "${local.handbook_hostname}${path}"
        target_url            = destination
        status_code           = 308
        include_subdomains    = false
        subpath_matching      = false
        preserve_path_suffix  = false
        preserve_query_string = false
      }
    }
  ]
}

resource "cloudflare_ruleset" "handbook_redirects" {
  account_id  = data.cloudflare_zone.handbook.account.id
  name        = "Polar handbook redirects"
  description = "Redirect legacy handbook URLs at the edge"
  kind        = "root"
  phase       = "http_request_redirect"

  rules = [{
    ref         = "polar_handbook_redirects"
    description = "Redirect matching requests to the Polar handbook"
    expression  = format("(http.host eq %q and http.request.full_uri in $%s)", local.handbook_hostname, cloudflare_list.handbook_redirects.name)
    action      = "redirect"
    action_parameters = {
      from_list = {
        name = cloudflare_list.handbook_redirects.name
        key  = "http.request.full_uri"
      }
    }
    enabled = true
  }]

  lifecycle {
    precondition {
      condition = alltrue([
        for ruleset in data.cloudflare_rulesets.handbook_account.rulesets :
        ruleset.name == "Polar handbook redirects"
        if ruleset.kind == "root" && ruleset.phase == "http_request_redirect"
      ])
      error_message = "The Cloudflare account already has a Bulk Redirects ruleset. Preserve its existing rules and add the handbook rule to that ruleset."
    }
  }
}

data "cloudflare_dns_records" "handbook" {
  zone_id = local.handbook_zone_id
  name    = { exact = local.handbook_hostname }
}

import {
  to = cloudflare_dns_record.handbook
  id = "${local.handbook_zone_id}/${one([for record in data.cloudflare_dns_records.handbook.result : record.id if contains(["A", "CNAME"], record.type)])}"
}

resource "cloudflare_dns_record" "handbook" {
  zone_id = local.handbook_zone_id
  name    = local.handbook_hostname
  type    = "A"
  content = "192.0.2.1"
  proxied = true
  ttl     = 1

  depends_on = [cloudflare_ruleset.handbook_redirects]
}
