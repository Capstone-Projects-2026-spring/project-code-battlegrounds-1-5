# Secure Code Execution
Originally, we had planned to use a few Cloud Run services (one for each language) and issue a direct API call to them. Sadly, secure execution requires some kind of rootjail (we are using nsjail), which use Linux primitives not available in containers without explicit configuration not allowed by Cloud Run. It is allowed for GKE but would cost a lot per month.

My proposed solution is to create a Cloud Run service that subscribes to execution requests. It can spin up Compute VMs which can run code in nsjail. It can manage current deployed VMs and spin up more as needed, as well as destroying unused VMs to keep costs low.

This folder contains two folders, an orchestrator and an executor. The orchestrator reads from Redis and sends API calls directly to the VMs.

MASSIVE TODO:
- ensure how we can instantiate VMs with specific images - containers?
- create orchestrator as determined above. it must handle retries as needed if its talking via API to the VMs. a lock is a good idea as well to ensure code is not run on different backends.
- modify executor so it can run ALL languages (for now just js tho). may need to recreate rootfs as needed.
- add deployments to terraform