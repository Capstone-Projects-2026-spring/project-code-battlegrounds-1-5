---
sidebar_position: 5
---

# Use-case descriptions

# Use Case 1 (Account Creation)
1. User opens site and needs to create an account.
2. User selects "Log in with Google."
3. Internally, Google OAuth handles authentication and an database entry is created for the user details.
4. The user is now logged in.

# Use Case 2 (Signing In)
1. User opens site and already has an account. 
2. User selects "Log in with Google."
3. Internally, Google OAuth handles authentication.
4. A database entry is checked for existence containing user details.
5. The user is now logged in.

# Use Case 3 (Default Matchmaking)
1. User is logged in.
2. User would like to start a game.
3. They would like to be paired with anyone available.
4. They press the matchmaking button and matchmaking begins.

# Use Case 3 (Party Matchmaking)
1. User is logged in and would like to be teamed up with a friend.
2. They party with the friend and start matchmaing, which will team them up and place them against another team.
