# Code Battleground Infra
This folder contains the Terraform files necessary to deploy the project.

Always use `-parallelism=3` in Cloud Shell to avoid TLS rate-limiting errors.

Initial deploy: `terraform apply --target=modules.bootstrap -parallelism=3`

App deploy: `terraform apply --target=modules.app --parallelism=3"

Eventually we will move to tagging images with Git commit and inject it into terraform such that it's not just using `:latest` tag, which makes deployments harder.

To run database deployment job use:
`gcloud run jobs execute migrate-job --region us-central1`

# Infra notes
- We are using CloudSQL for persistent storage and Memorystore for fast ephemeral access.
- CloudRun pulls image automatically, so just redo the apply command to update.
- CloudRun connects to CloudSQL via a service account that connects to a CloudSQL Auth Proxy.
- CloudRun connects to Memorystore via a VPC Access Container because Memorystore is only accessible inside the VPC. The connector allows Cloud Run (a serverless service) to join the VPC subnet where Redis is deployed.
