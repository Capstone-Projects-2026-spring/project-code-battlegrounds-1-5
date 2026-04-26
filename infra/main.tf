# we use this root module to reference the bootstrap and app modules.
# this way we can issue apply and destroy commands for the app directly and leave the always on infra like artifact registry
# and the vpc on and take the expensive services down as needed

terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
  }
}

provider "google" { # we use this generated terraform key for auth. generate service account and save key as needed
  // credentials = file("/home/juli4fasick/terraform-key.json")
  project     = var.project_id
  region      = var.region
}

module "bootstrap" { // always on
  source = "./modules/bootstrap"
  region = var.region
}

module "app" {
  source = "./modules/app"

  region             = var.region
  image_url          = var.image_url
  db_user            = var.db_user
  # inputs from bootstrap outputs (which must be run first)
  vpc_network_id     = module.bootstrap.vpc_network_id
  vpc_connector_id   = module.bootstrap.vpc_connector_id
  vpc_connector_name = module.bootstrap.vpc_connector_name
}
