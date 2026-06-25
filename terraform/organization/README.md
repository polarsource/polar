# AWS Organizations

This Terraform root manages Polar's AWS Organizations structure.

## Layout

```text
AWS Organization
├── Management account: polar
└── Workloads
    ├── Production
    │   └── production
    ├── Sandbox
    │   └── sandbox
    └── Test
        └── test
```

The management account owns the AWS Organization control plane. It should stay limited to
organization administration, billing, account lifecycle, delegated administrator registration,
and other tasks that must run from the management account.

Application workloads live under the `Workloads` OU:

- `Production` contains the public production environment.
- `Sandbox` contains the sandbox production-class environment.
- `Test` contains the staging/test environment.

## Guardrails

- Attach guardrails that apply to every application account to `Workloads`.
- Attach production-class guardrails to both `Production` and `Sandbox`.
- Attach test/staging-specific guardrails to `Test`.

## Terraform Ownership

Terraform manages the workload OUs and member account placement.

The management account is verified through the Organizations data source but is not managed as an
`aws_organizations_account` resource because that resource manages member accounts, not the
management account itself.

Terraform also creates an HCP Terraform run role named `terraform-cloud` in each workload account.
Those roles trust HCP Terraform's AWS dynamic credentials issuer and are scoped to the matching
workspace:

```text
production account -> polar workspace
sandbox account    -> sandbox workspace
test account       -> test workspace
```

The HCP Terraform workspace variables that point each workspace at its AWS role are managed from
`terraform/global`.

## Staff access (IAM Identity Center)

`identity_center.tf` defines three access tiers, each with a per-account permission set named
`Polar<Tier><Account>` (e.g. `PolarReadOnlySandbox`). Sets are assigned to Google Workspace groups
across all accounts:

| Group                                            | Permission set              | Access                                              |
| ------------------------------------------------ | --------------------------- | --------------------------------------------------- |
| `awsadmins@polar.sh`                             | `PolarAdmin<Account>`       | Unrestricted administrator                          |
| `awsengineers@polar.sh`, `engineering@polar.sh`  | `PolarEngineering<Account>` | Power-user (no IAM/Organizations), bounded by `PolarPermissionBoundary` |
| `awsaccess@polar.sh`                             | `PolarReadOnly<Account>`    | Read-only                                           |

Group membership is not managed here; manage it in the Identity Center console or via SCIM from
Google Workspace.

## Permission boundary

`PolarPermissionBoundary` (the `permission_boundary` module) is deployed to every account and caps
the privileges of internal roles and users. It is enforced in three ways:

- The `PolarEngineering*` permission sets attach it to engineer sessions.
- Role-creating modules take a `permissions_boundary_arn` so application and CI roles carry it; the
  `terraform-cloud` automation roles are exempt.
- The `RequirePermissionsBoundary` SCP on the `Workloads` OU requires the boundary on new
  roles/users and protects it from removal.

The `organization` workspace creates the boundary in every account, so it must apply before the
`sandbox`/`test` workspaces that reference it.
