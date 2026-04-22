<div align="center">

# Code Battlegrounds
<!-- [![Report Issue on Jira](https://img.shields.io/badge/Report%20Issues-Jira-0052CC?style=flat&logo=jira-software)](https://temple-cis-projects-in-cs.atlassian.net/jira/software/c/projects/DT/issues) -->

[![Documentation Website Link](https://img.shields.io/badge/-Documentation%20Website-brightgreen)](https://capstone-projects-2026-spring.github.io/project-code-battlegrounds-1-5/)


</div>


## Keywords

- Section 1
- Multiplayer
- Game
- Pair-programming
- Real-time

## Project Abstract

This repository contains a multiplayer web game that is meant to teach collaborative programming concepts. It utilizes pair-programming, where each user must complete their part to ensure the solution meets all requirements. The coder writes the code to solve the prompt. The quality assurance user cannot edit the code. They can write test cases, and run them. They can discuss potential approaches or failing tests and how to fix them with the coder.


## High Level Requirement

From a user's perspective, the application must provide an intuitive way to complete their tasks. It needs to support low latency communication between clients. It also must support fast and secure untrusted code execution for user submissions and test cases. The scoring system must be robust and fair, prioritizing efficient code over fast submissions.

## Conceptual Design

Tech Stack:
- Bun
- Node.js
- Next.js
- TypeScript
- Socket.io
- Socket.io Redis Adapter
- JavaScript
- Playwright
- Jest
- BetterAuth
- Prisma ORM
- PostgreSQL
- Redis

The frontend includes Bun as a runtime, which launches a Node.js websocket server using Next.js routing.

The backend is designed to be stateless and inherently scalable. Redis is used for game state, such as timers, code, etc. PostgreSQL is used for persistence data such as match results through Prisma ORM. 


## Background

Previous similar projects include leetcode.com and hackerrank.com, known for their programming challenges. They do not offer any form of collaboration, which fails to realistically simulate a developer's life.

Pair-programming has been shown to be "faster than solo programming when programming task complexity is low and yields code solutions of higher quality when task complexity is high." (See [here](https://www.sciencedirect.com/science/article/abs/pii/S0950584909000123)).

We hope that necessitating pair-programming will encourage better testing, documentation, and communication among those learning to write code.

As far as we can tell, this is the first platform of its type.


## Required Resources

To use the web application, a computer with an active internet connection will be required.


## Development

To develop, you will need a computer with Git, Node, Bun, and Docker Compose.

### Environment Setup
1. Clone the repository.
2. Create a `.env` file and populate it with the following (filling the tokens as needed, they shouldn't matter too much
   for local development):
    ```
    # config
    PORT=3000
    NODE_ENV=development
   
    # db seeding configs
    # password for the test accounts. in prod, ensure we inject this into the db script with something secure
    TEST_ACCS_PASSWORD=password123
    # if you ever want to seed the db with a single problem (two sum), uncomment this line
    #DEMO_MODE=false
   
    # better auth
    BETTER_AUTH_SECRET=SOME_SECRET_TOKEN
    BETTER_AUTH_URL=http://localhost:3000
    
    # postgres
    POSTGRES_USER=appuser
    POSTGRES_PASSWORD=SOME_SECRET_TOKEN
    POSTGRES_DB=appdb
    POSTGRES_HOST=localhost
    POSTGRES_PORT=5432

    # redis
    REDIS_HOST=localhost
    REDIS_PORT=6379
   
    # executor image
    EXECUTOR_PORT=6969
    EXECUTOR_ADDR=http://127.0.0.1:6969

    # for prisma
    DATABASE_URL=postgresql://appuser:SOME_SECRET_TOKEN@localhost:5432/appdb

    # for posthog
    NEXT_PUBLIC_POSTHOG_KEY=phc_Io7LeSThy8dz3wDLgPJCcKsWny6zZkapNnyrnPRI1gN
    NEXT_PUBLIC_POSTHOG_HOST=https://cbt.strange.boats

   # for seed script
   TEST_ACCS_PASSWORD=password123
    ```
   Remember to `source` as needed!
3. Run `bun install` to install the dependencies.
4. Run `bunx --bun prisma generate` to generate the Prisma client and database migrations.
5. Run `docker compose -f ./dev-docker-compose.yml up -d` to bring up the containers (you may need to run as root).
6. Run `bunx --bun prisma migrate dev` to bring the database up to schema.
7. Run `bunx --bun prisma db seed` to add mock data to the dev database.
8. Run `bun dev` to launch the development server and navigate to `localhost:3000` to view the page.
9. When done, `docker compose -f ./dev-docker-compose.yml down` will bring the containers down.

### Helpful Common Commands and Tricks
- `docker compose -f ./dev-docker-compose.yml down -v` will stop the containers and purge the volumes. Good if you _really_ mess something up (you WILL lose data!).
- `bunx --bun prisma migrate reset` will drop the DB (you WILL lose data!).
- If your database is stuck out of sync and you can't apply migrations, run `rm -rf ./prisma/migrations/**` to remove all pending migrations. Then recreate the migration with `bunx prisma migrate dev --name dev` and apply it.
- If you want to pull new images, just run `sudo docker compose -f ./dev-docker-compose.yml pull`.
- To see how the websockets are working, try opening up the game page in an incognito tab to be registered as a different client.

## Testing
We use two testing libraries: Jest and Playwright. Jest is used for individual API tests while Playwright is used for end-to-end flow tests.

To run the Playwright tests, ensure you have the application running and run `bunx playwright test --workers=1`.
You may need to have Chromium headless installed.

For the Jest tests, run `bunx jest tests/api/ --forceExit`.

## Infrastructure Development
To develop the infrastructure or deploy the app, you must have a Google Cloud account. While I won't supply specific instructions (trust me, if you want to deploy on this - you will have to be precocious and persistent), the basic flow is that you will need to create a service account and store it's credentials in your cloud environment, then edit the main.tf file to reference it.

There are some more specific commands in the /infra/README.md file to help get you started.

Estimated deployment costs are ~40$/month dependent on usage. This is primarily due to the cost of Memorystore for Redis.

Check out the /build-artifacts folder for the Docker files and cloudbuild configs.

## Code Executor Development
The code executor is a 3 layer system for production. Code is sent by the application to a VM orchestrator, which spins up and maintains a pool of Compute Engines as needed. The VMs in turn spin up Docker containers running an Alpine image, which pivot to new rootfs via a nsjail rootjail where the code is actually executed. There are a lot of moving parts to this system. For more info, take a look ath the /code-executor/README.md file.

It is build on Python's fastapi for relatively easy development and integration with Google's compute APIs.

## Collaborators

<div align="center">

[//]: # (Replace with your collaborators)
[Julia Fasick](https://github.com/julia-fasick) • [Jesse Herrera](https://github.com/JesseHerrera04) • [Kyle Fauntroy](https://github.com/safebootup) • [Elan Reizas](https://github.com/ElanReizas) • [Samir Buch](https://github.com/samirbuch) • [Michael Zach](https://github.com/Mzach55)
• [Saad Chaudry](https://github.com/s0dl)

</div>
