project_id                    = "prj-saudefamiliar-pessoal-pfl"
region                        = "southamerica-east1"
deploy_service_account_email  = "sa-saudefamiliar-deploy@prj-saudefamiliar-pessoal-pfl.iam.gserviceaccount.com"
runtime_service_account_email = "sa-saudefamiliar-runtime@prj-saudefamiliar-pessoal-pfl.iam.gserviceaccount.com"
enable_artifact_registry      = true

cloud_run_service_name = "saude-familiar-api"
container_image        = "southamerica-east1-docker.pkg.dev/prj-saudefamiliar-pessoal-pfl/saude-familiar/saude-familiar@sha256:1b461d6119c70e37357d053a81a70d661b1c22fc5f2cee06a8f295d9a6f75705"

container_port = 8080
cpu            = "1"
memory         = "512Mi"

min_instance_count = 0
max_instance_count = 1

enable_startup_probe      = true
enable_public_mock_access = false

enable_cloud_run = true

labels = {
  environment = "lab"
  app         = "saude-familiar"
  managed_by  = "terraform"
}
