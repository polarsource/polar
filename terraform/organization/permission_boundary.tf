module "permission_boundary_management" {
  source = "../modules/permission_boundary"
  providers = {
    aws = aws
  }
}

module "permission_boundary_production" {
  source = "../modules/permission_boundary"
  providers = {
    aws = aws.production
  }
}

module "permission_boundary_sandbox" {
  source = "../modules/permission_boundary"
  providers = {
    aws = aws.sandbox
  }
}

module "permission_boundary_test" {
  source = "../modules/permission_boundary"
  providers = {
    aws = aws.test
  }
}

module "permission_boundary_identity" {
  source = "../modules/permission_boundary"
  providers = {
    aws = aws.identity
  }
}

module "permission_boundary_security" {
  source = "../modules/permission_boundary"
  providers = {
    aws = aws.security
  }
}
