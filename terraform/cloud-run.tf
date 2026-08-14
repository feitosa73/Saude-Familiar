resource "google_cloud_run_v2_service" "saude_familiar" {
  count               = var.enable_cloud_run ? 1 : 0
  name                = var.cloud_run_service_name
  location            = var.region
  project             = var.project_id
  ingress             = "INGRESS_TRAFFIC_ALL"
  labels              = var.labels
  deletion_protection = false

  template {
    service_account = var.runtime_service_account_email

    containers {
      image = var.container_image

      ports {
        container_port = var.container_port
      }

      resources {
        limits = {
          cpu    = var.cpu
          memory = var.memory
        }
      }

      startup_probe {
        initial_delay_seconds = 0
        timeout_seconds       = 3
        period_seconds        = 5
        failure_threshold     = 6

        http_get {
          path = "/api/health"
          port = var.container_port
        }
      }
    }

    scaling {
      min_instance_count = var.min_instance_count
      max_instance_count = var.max_instance_count
    }
  }
}

resource "google_cloud_run_v2_service_iam_member" "public_access" {
  count    = (var.enable_cloud_run && var.enable_public_mock_access) ? 1 : 0
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.saude_familiar[0].name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
