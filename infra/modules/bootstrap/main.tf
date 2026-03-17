# this file contains always on bootstrap, should only be deployed once

# required apis
resource "google_project_service" "services" {
  for_each = toset([
    "run.googleapis.com",
    "sqladmin.googleapis.com",
    "artifactregistry.googleapis.com",
    "redis.googleapis.com",
    "compute.googleapis.com",
    "vpcaccess.googleapis.com",
    "iam.googleapis.com",
    "secretmanager.googleapis.com"
  ])

  service = each.value
}

# vpc for redis
resource "google_compute_network" "vpc" {
  name                    = "app-vpc"
  auto_create_subnetworks = false
}

# vpc subnet
resource "google_compute_subnetwork" "subnet" {
  name          = "app-subnet"
  ip_cidr_range = "10.10.0.0/24"
  region        = var.region
  network       = google_compute_network.vpc.id
}

# vpc access connector for serverless to vpc
resource "google_vpc_access_connector" "connector" {
  name          = "app-connector"
  region        = var.region
  network       = google_compute_network.vpc.name
  ip_cidr_range = "10.8.0.0/28"
}

# art registry
resource "google_artifact_registry_repository" "app" {
  location      = var.region
  repository_id = "app"
  description   = "Application images"
  format        = "DOCKER"
}
