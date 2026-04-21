# runtime resources such as cloud run, jobs, redis, postgres, etc

# secret secret, i have a secret
data "google_secret_manager_secret_version" "better_auth_secret" {
  secret  = "better-auth-secret"
  version = "latest"
}

data "google_secret_manager_secret_version" "postgres_password" {
  secret  = "postgres-password"
  version = "latest"
}

# cloud sql
resource "google_sql_database_instance" "postgres" {
  name                = "app-postgres"
  database_version    = "POSTGRES_15"
  region              = var.region
  deletion_protection = false

  settings {
    tier = "db-f1-micro"
  }
}

# user to communicate with cloud sql
resource "google_sql_user" "app" {
  name     = var.db_user
  instance = google_sql_database_instance.postgres.name
  password = data.google_secret_manager_secret_version.postgres_password.secret_data
}

# db itself to sit in sql instance
resource "google_sql_database" "appdb" {
  name     = "appdb"
  instance = google_sql_database_instance.postgres.name
}

# redis
resource "google_redis_instance" "redis" {
  count              = 1
  name               = "app-redis"
  tier               = "BASIC"
  memory_size_gb     = 1
  region             = var.region
  authorized_network = var.vpc_network_id
  redis_configs = {
    notify-keyspace-events = "Ex"
  }
}

# cloud run migrate job to apply db deployments
# execute with: gcloud run jobs execute migrate-job --region ${var.region}
resource "google_cloud_run_v2_job" "migrate" {
  name     = "migrate-job"
  location = var.region

  template {
    template {
      containers {
        image = "us-central1-docker.pkg.dev/code-battlegrounds/app/migrate:latest"
        env {
          name  = "DATABASE_URL"
          value = "postgresql://${var.db_user}:${data.google_secret_manager_secret_version.postgres_password.secret_data}@localhost/appdb?host=%2Fcloudsql%2F${google_sql_database_instance.postgres.connection_name}"
        }
        command = ["npx"]
        args    = ["prisma", "migrate", "deploy"]
        resources {
          limits = {
            memory = "1024Mi"
          }
        }
      }
      vpc_access {
        connector = var.vpc_connector_id
        egress    = "PRIVATE_RANGES_ONLY"
      }

      volumes {
        name = "cloudsql"
        cloud_sql_instance {
          instances = [google_sql_database_instance.postgres.connection_name]
        }
      }
    }
  }
}
# orchestrator Cloud Run service for code execution
# public for simplicity; tighten IAM in production
resource "google_cloud_run_service" "orchestrator" {
  name     = "orchestrator"
  location = var.region

  template {
    metadata {
      annotations = {
        "run.googleapis.com/vpc-access-connector" = var.vpc_connector_name
        "run.googleapis.com/vpc-access-egress"    = "private-ranges-only"
      }
    }

    spec {
      containers {
        image = "us-central1-docker.pkg.dev/code-battlegrounds/app/orchestrator:latest"

        env {
          name  = "PORT"
          value = "8080"
        }
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }
}

# make orchestrator service public (so app can call it easily). this will need to change after testing
resource "google_cloud_run_service_iam_member" "orchestrator_public" {
  service  = google_cloud_run_service.orchestrator.name
  location = google_cloud_run_service.orchestrator.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# cloud run itself for the app
resource "google_cloud_run_service" "app" {
  name     = "app"
  location = var.region

  template {
    metadata {
      annotations = {
        "run.googleapis.com/cloudsql-instances"   = google_sql_database_instance.postgres.connection_name
        "run.googleapis.com/vpc-access-connector" = var.vpc_connector_name
        "run.googleapis.com/vpc-access-egress"    = "private-ranges-only"
      }
    }

    spec {
      containers {
        image = var.image_url

        env {
          name  = "BETTER_AUTH_URL"
          value = "https://app-hnjkqlohiq-uc.a.run.app"
        }

        env {
          name  = "BETTER_AUTH_SECRET"
          value = data.google_secret_manager_secret_version.better_auth_secret.secret_data # pull secret from secret manager. technically this exposes it in the .tfstate but it only is a risk if others have access to the shell you deploy from
        }

        # prisma expects DATABASE_URL
        env {
          name  = "DATABASE_URL"
          value = "postgresql://${var.db_user}:${data.google_secret_manager_secret_version.postgres_password.secret_data}@localhost/appdb?host=%2Fcloudsql%2F${google_sql_database_instance.postgres.connection_name}"
        }

        # expose individual vars incase the app wants them
        env {
          name  = "POSTGRES_USER"
          value = google_sql_user.app.name
        }

        env {
          name  = "POSTGRES_PASSWORD"
          value = data.google_secret_manager_secret_version.postgres_password.secret_data
        }

        env {
          name  = "POSTGRES_DB"
          value = google_sql_database.appdb.name
        }

        env {
          name  = "REDIS_HOST"
          value = google_redis_instance.redis[0].host
        }

        env {
          name  = "REDIS_PORT"
          value = "6379"
        }

        # posthog config
        env {
          name  = "NEXT_PUBLIC_POSTHOG_KEY"
          value = "phc_Io7LeSThy8dz3wDLgPJCcKsWny6zZkapNnyrnPRI1gN"
        }
        env {
          name  = "NEXT_PUBLIC_POSTHOG_HOST"
          value = "https://cbt.strange.boats"
        }

        # execution addr
        env {
          name  = "EXECUTOR_ADDR"
          value = "${google_cloud_run_service.orchestrator.status[0].url}:8080"
        }
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }
}

# this makes the service public
resource "google_cloud_run_service_iam_member" "public" {
  service  = google_cloud_run_service.app.name
  location = google_cloud_run_service.app.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}
