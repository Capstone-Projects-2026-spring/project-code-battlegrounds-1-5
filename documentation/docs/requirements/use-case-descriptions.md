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

# Use Case 4 (Full Game Flow)
1. Matchmaking completes, user is assigned initial role of code writer.
2. User sees problem and begins to write code. Function names and associated JavaDocs are sent to the tester's machine.
3. Tester writes and runs unit tests for functions exposed. Unit test results are sent back to coder's machine.
4. Halfway through match, user roles switch.
5. When all tests are passing, code is submitted for scoring.
6. Code is graded based on correctness, efficiency (runtime), validity of unit tests, and overall time taken to finish prompt.
7. Player rankings updated based on score.

# Use Case 5 (Perfect Game Flow)
1. Matchmaking completes, user is assigned initial role of code writer.
2. User sees problem and begins to write code. Function names and associated JavaDocs are sent to the tester's machine.
3. Tester writes and runs unit tests for functions exposed. Unit test results are sent back to coder's machine.
4. All tests are passing, code is submitted for scoring.
6. Code is graded based on correctness, efficiency (runtime), validity of unit tests, and overall time taken to finish prompt.
7. Player rankings updated based on score.

# Use Case 6 (Worst-Case Game Flow)
1. Matchmaking completes, user is assigned initial role of code writer.
2. User sees problem and begins to write code. Function names and associated JavaDocs are sent to the tester's machine.
3. Tester writes and runs unit tests for functions exposed. Unit test results are sent back to coder's machine.
4. Halfway through match, user roles switch.
5. All tests still not passing.
6. Timer runs out.
7. Code is auto-submitted for grading, with penalties applied for incorrectness and running out of time.
8. Player rankings updated based on score.