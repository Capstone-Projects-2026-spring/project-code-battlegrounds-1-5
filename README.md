<div align="center">

# Project Name
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

Previous similar projects include leetcode.com, known for its programming challenges. It does not offer any form of collaboration, and fails to realistically simulate a developer's life.

Pair-programming has been shown to be "faster than solo programming when programming task complexity is low and yields code solutions of higher quality when task complexity is high." (See [here](https://www.sciencedirect.com/science/article/abs/pii/S0950584909000123)).

We hope that necessitating pair-programming will encourage better testing, documentation, and communication among those learning to write code.

As far as we can tell, this is the first platform of its type.


## Required Resources

To use the product, a computer with an active internet connection will be required.

Discuss what you need to develop this project. This includes background information you will need to acquire, hardware resources, and software resources. If these are not part of the standard Computer Science Department lab resources, these must be identified early and discussed with the instructor.


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
    
    # redis
    REDIS_HOST=localhost
    REDIS_PORT=6379
    
    # for prisma
    DATABASE_URL=postgresql://DB_USER:DB_SECRET_TOKEN@DB_HOST:DB_PORT/DB_NAME
    
    ```
3. Run `bun install` to install the dependencies.
4. Run `bunx prisma generate` to generate the Prisma client and database migrations.
5. Run `bunx prisma migrate` to 

## Collaborators

<div align="center">

[//]: # (Replace with your collaborators)
[Julia Fasick](https://github.com/julia-fasick) • [Jesse Herrera](https://github.com/JesseHerrera04) • [Kyle Fauntroy](https://github.com/safebootup) • [Elan Reizas](https://github.com/ElanReizas) • [Samir Buch](https://github.com/samirbuch) • [Michael Zach](https://github.com/Mzach55)
• [Saad Chaudry](https://github.com/s0dl)

</div>

## Testing

```
bunx playwright test --workers=1
```