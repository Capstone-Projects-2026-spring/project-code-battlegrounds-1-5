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
2. Create a `.env` file and populate it with the following (filling the tokens as needed, they shouldn't matter too much for local development):
    ```
    # config
    PORT=3000
    NODE_ENV=development
    
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

    # for prisma
    DATABASE_URL=postgresql://appuser:SOME_SECRET_TOKEN@localhost:5432/appdb

    # for posthog
    NEXT_PUBLIC_POSTHOG_KEY=phc_Io7LeSThy8dz3wDLgPJCcKsWny6zZkapNnyrnPRI1gN
    NEXT_PUBLIC_POSTHOG_HOST=https://cbt.strange.boats
    ```
   Remember to `source` as needed!
3. Run `bun install` to install the dependencies.
4. Run `bunx --bun prisma generate` to generate the Prisma client and database migrations.
5. Run `docker compose up -d` to bring up the containers (you may need to run as root).
6. Run `bunx --bun prisma migrate dev` to bring the database up to schema.
7. Run `bunx --bun prisma db seed` to add mock data to the dev database.
8. Run `bun dev` to launch the development server and navigate to `localhost:3000` to view the page.
9. When done, `docker compose down` will bring the containers down.

### Helpful Common Commands and Tricks
- `docker compose down -v` will stop the containers and purge the volumes. Good if you _really_ mess something up (you WILL lose data!).
- `bunx --bun prisma migrate reset` will drop the DB (you WILL lose data!).
- If your database is stuck out of sync and you can't apply migrations, run `rm -rf ./prisma/migrations/**` to remove all pending migrations. Then recreate the migration with `bunx prisma migrate dev --name dev` and apply it.
- Sometimes changing between calling prisma with `bunx` or `bunx --bun` or vice versa can help as well.
- If you want to pull new images, just run `sudo docker compose pull`.
- To see how the websockets are working, try opening up the game page in an incognito tab to be registered as a different client.

## Testing
We use one testing library: 
Jest is used for individual API tests 

For the Jest tests, run `bunx jest tests/api/ --forceExit`.
## Collaborators

<div align="center">

[//]: # (Replace with your collaborators)
[Julia Fasick](https://github.com/julia-fasick) • [Jesse Herrera](https://github.com/JesseHerrera04) • [Kyle Fauntroy](https://github.com/safebootup) • [Elan Reizas](https://github.com/ElanReizas) • [Samir Buch](https://github.com/samirbuch) • [Michael Zach](https://github.com/Mzach55)
• [Saad Chaudry](https://github.com/s0dl)

</div>
