variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP Region for deployment"
  type        = string
  default     = "southamerica-east1"
}

variable "labels" {
  description = "Resource labels"
  type        = map(string)
  default     = {}
}

variable "deploy_service_account_email" {
  description = "Service Account email used for deployments"
  type        = string
}

variable "runtime_service_account_email" {
  description = "Service Account email used at runtime by Cloud Run"
  type        = string
}

variable "enable_artifact_registry" {
  description = "Flag to enable Artifact Registry resources"
  type        = bool
  default     = true
}

variable "enable_cloud_run" {
  description = "Flag to enable Cloud Run service"
  type        = bool
  default     = false
}

variable "cloud_run_service_name" {
  description = "Name of the Cloud Run service"
  type        = string
  default     = "saude-familiar-api"
}

variable "container_image" {
  description = "Fully qualified container image URL with digest or tag"
  type        = string
}

variable "container_port" {
  description = "Port exposed by the container"
  type        = number
  default     = 8080
}

variable "cpu" {
  description = "CPU limit for Cloud Run instance"
  type        = string
  default     = "1"
}

variable "memory" {
  description = "Memory limit for Cloud Run instance"
  type        = string
  default     = "512Mi"
}

variable "min_instance_count" {
  description = "Minimum number of instances (0 for scale-to-zero)"
  type        = number
  default     = 0
}

variable "max_instance_count" {
  description = "Maximum number of instances"
  type        = number
  default     = 1
}

variable "enable_startup_probe" {
  description = "Flag to enable startup probe on Cloud Run"
  type        = bool
  default     = true
}

variable "enable_public_mock_access" {
  description = "Flag to allow unauthenticated public access (allUsers)"
  type        = bool
  default     = false
}
