---
sidebar_position: 1
---

# Production Architecture

## Overview

The architecture is designed with a high level of inherent scalability, both vertically and horizontally. This is
achieved with an ephemeral, stateless application that can be autoscaled by orchestration systems. For local
development, the application can be run with a `.env` file and `docker-compose.yml`
file (see [development-environment.md](./development-environment.md)). This environment maps as perfectly to production as possible, as discussed later.

The API and websocket server connect with two different data stores. For quick-access, ephemeral data, [Redis](https://redis.io/) is
utilized. For an authoritative data store, [PostgreSQL](https://www.postgresql.org/) will be used. For more
information on the database design, see [Database Schema](database-schema.md)

## Diagram and Explanation

```plantuml-diagram
@startuml
skinparam shadowing false
skinparam linetype ortho
skinparam wrapWidth 200
skinparam defaultTextAlignment center
left to right direction

title Production Infrastructure

actor "End User" as user

  node "Artifact Registry\n(DOCKER format)" as ar
  cloud "VPC Network: vpc" as vpc {
    node "Serverless VPC Access Connector\nName: connector" as vpcac
    rectangle "Subnet: subnet\nCIDR: 10.10.0.0/24" as subnet {
      node "Memorystore (Redis)\nName: redis\nTier: BASIC, 1 GiB" as redis
    }
  }
  database "Cloud SQL (PostgreSQL 15)\nInstance: postgres\nDB: appdb" as sql
  node "Cloud Run Service\nName: app" as app
  node "Cloud Run Job\nName: migrate-job" as migrate
  node "Cloud Run Job\nName: db-seed-job" as seed
  node "Cloud Run Service\nName: orchestrator" as orch
  cloud "VM Pool" as pool
  

  ' layout constraint: keep ar to the left of app
  ar -[hidden]-> app

note right of sql
  Accessed using Cloud SQL Auth Proxy and mounted by Cloud Run. Authenticated via service account.
end note

note right of redis
  Redis is only authorized to be accessed through the VPC network, hence the subnet in the VPC and Access Connector.
end note

note right of pool
  The orchestrator spins up and destroys VMs that run an API to talk with. They in turn spin up containers where code runs in a pivoted root filesystem inside nsjail.
end note

migrate ..> sql
seed ..> sql

ar ..> app : image
ar ..> migrate : image
ar ..> seed: image
ar ..> orch: image

app --> sql
app --> vpcac
app -> orch
orch ..> pool
user --> app
@enduml
```

The above diagram demonstrates how the application is deployed via a GitHub action CI/CD pipeline. Two images are
created: the actual runner application (minimal, production environment from a multi-stage build) and the `migrate`
image, who's only job is to be run in a Cloud Run Job that deploys database schema updates when needed.

Note the high level of scalability: vertically, the tiniest, lowest-tier of machines are provisioned, allowing for
minimal development overhead and easy scaling if it should be needed. Additionally, the Cloud Run Service itself is horizontally
scalable from 0 -> N as needed. This architecture also allows for later multi-region scaling by moving the Cloud Run
Service into the VPC and creating clones of that VPC for individual regions. If needed, Cloud SQL can be scaled as well,
even put behind a [Kubernetes StatefulSet](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/) if
necessitated by scale.

It is worth noting that this architecture has some... issues. Right now, the orchestrator uses public IPs instead of internal addresses, meaning that anyone with your Cloud Run URL can spin up VMs on your bill.
The Cloud Run Service itself is not a great place for websockets. The fact that it's ephemeral and the environment can be affected by other service's usage is a massive issue. It means that websockets sometimes lose connections, and no matter how gracefully you handle it, the Redis state will always be slightly tainted by this eventually, leading to some of the weirdest and most undefined behavior I've ever seen.

The fix for this would be to replace the Cloud Run service for the app with literally anything else. A single VM would work, or a GKE cluster would provide more of the scalability we aim for. With that, the app itself should behave a lot better in production. If you're thinking of deploying this after seeing our demo, note that we actually did not have this deployed on GCP for the demo. It was instead built on Julia's server, as we scrapped everything on GCP except the Artifact Registry at 10PM the night prior after hunting down the umpteenth state bug that wasn't happening locally.
## Detailed Breakdown

### [Artifact Registry](https://docs.cloud.google.com/artifact-registry/docs)

- Hosts container images built by CI/CD pipeline (specifically, a [
  `gcloud builds`](https://docs.cloud.google.com/sdk/gcloud/reference/builds) call).
- Serves the images as needed to the `migrate` job, the orchestrator, the executor image, and the Cloud Run Service itself.
- Allows for quick, painless, and reproducible deployment.

### [Cloud Run Service](https://cloud.google.com/run)

- Runs the container image pulled from Artifact Registry.
- Stores ephemeral data in Memorystore.
- Stores authoritative, persistent data in CloudSQL.
- Environment variables injected at runtime, so production environment can perfectly match local environment.
- 0 -> N scaling allows for 0% overhead during idle periods (in contradiction to
  traditional [Google Kubernetes Engine](https://cloud.google.com/kubernetes-engine) approaches).
- Orchestrator Cloud Run service deploys the orchestrator built in this repo.

### [Cloud Run Migrate/Seed Job](https://docs.cloud.google.com/run/docs/create-jobs)

- Runs specialized image built automagically by the `gcloud builds` call and hosted in the Artifact Registry.
- Handles deployment of database schemas and applies migrations as needed.
- Manually ran only when needed.
- Removes need for Cloud Run image to handle database deployments and migrations at run time (a security risk and
  high-coupled nightmare where database issues will stop the app from even starting).
- Seed job seeds the database with questions and test users.

### [CloudSQL](https://cloud.google.com/sql)

- Used for authoritative, persistent data store such as problem sets, user data, and match results.
- Can be vertically and horizontally scaled if needed.
- Migrations and deployment handled by Cloud Run Job.
- See [Database Schema](./database-schema.md) for schema information.

### [Serverless VPC Access Connector](https://docs.cloud.google.com/vpc/docs/serverless-vpc-access)

- Allows serverless traffic from Cloud Run to access Memorystore on the subnet defined.
- Protects Memorystore, as Memorystore is not designed for any authentication, just low-latency private communications.

### [Memorystore](https://cloud.google.com/memorystore)

- Used for low-latency (~1ms), ephemeral storage, such as in-progress match data.
- No authentication, must be protected by only accepting private connections through the Access Connector.
- Completed matches will be written to the authoritative store, CloudSQL.