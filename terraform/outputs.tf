output "cloud_run_service_uri" {
  description = "The URI of the created Cloud Run service"
  value       = var.enable_cloud_run && length(google_cloud_run_v2_service.saude_familiar) > 0 ? google_cloud_run_v2_service.saude_familiar[0].uri : null
}

output "cloud_run_service_name" {
  description = "The name of the Cloud Run service"
  value       = var.enable_cloud_run && length(google_cloud_run_v2_service.saude_familiar) > 0 ? google_cloud_run_v2_service.saude_familiar[0].name : null
}
