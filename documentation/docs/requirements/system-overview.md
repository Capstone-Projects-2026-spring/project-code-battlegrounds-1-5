---
sidebar_position: 1
---

# System Overview

# Project Abstract
The purpose of this document is to present the proposal for an interactive Web Application that combines the benefits of gamification and collaboration to help develop teamwork in programming. The application allows Users to team up with a partner to solve coding problems and compete with other Users in timed matches, promoting problem-solving skills, teamwork and collaboration skills, and time management skills. Once Users create accounts, they will each assume the role that consist of either coding or writing test cases, and they shall work together to brainstorm and implement solutions, iteratively coding and testing to ensure correctness in their code. Through the use of this Application, Users will see improved timeliness, collaborative skills, and overall coding performance.

# Conceptual Design
The frontend of the Web Application will be built using JavaScript, React, HTML, and CSS. React will be utilized to manage the state of the application frontend as well as create reusable and/or scalable UI components, with JavaScript, HTML/JSX, and CSS being used to implement the User Interface for the App. As for the backend of the application, both JavaScript and Next.js will be used to handle User Authentication and Authorization, data storage, and testing the User's input to ensure sdolutions are correct, leveraging RESTful APIs to handle traffic to and from the frontend and backend respectively. Redis and PostgreSQL will be utilized to store all the necessary data for the application, such as the User's data and progress in completing challenges.  

# Background
The product is based on two main concepts: coding challenges and pair programming. Similar products to these concepts include Leetcode and CodeSandbox Live. Leetcode provides coding challenges while CodeSandbox Live is an environment in which groups can code simulatenously. A product that is more similar to the overal goal of this product is Codewars. Codewars is a website where users can go to challenge themselves against other people's code. The main difference between CodeBattlegrounds and Codewars is that CodeBattlegrounds is in real-time whereas Codewards is much more leetcode. CodeBattlegrounds also implements the pair programming aspect of having a tester and a coder.