# Secure Code Execution
Originally, we had planned to use a few Cloud Run services (one for each language) and issue a direct API call to them. Sadly, secure execution requires some kind of rootjail (we are using nsjail), which use Linux primitives not available in containers without explicit configuration not allowed by Cloud Run. It is allowed for GKE but would cost a lot per month.

My proposed solution is to create a Cloud Run service that subscribes to execution requests. It can spin up Compute VMs which can run code in nsjail in containers with the custom Docker command. It can manage current deployed VMs and spin up more as needed, as well as destroying unused VMs to keep costs low.

## executor-image
Locally, the architecture is a whole lot simpler. The executor-image has an api which takes in an execute request with the code, the testcases, and the ids of the test cases to run. Note that all the test cases are passed in - the cases that are not run are still returned, but with null for the actual, passed, execution, time, etc. This is so they can be passed back to the backend, then to the frontend, which does the merging of results into the UI.

The executor runs this code in nsjail with a pivoted rootfs, with minimal dependencies. It accepts the code as a b64 string to avoid parsing issues with JSON delimiters. See the executor-image/models.py for structures.

The utils.py file has the source code for how things are run in the sandbox, as well as the formatting functions (which I hold as some of the ugliest code I've ever written - sorry). We have to format the arguments and literally paste them into the params of a console.log(function(PARAMS)) statement in the file that gets run in the rootjail. We also use the formatter to format the expected output so we can compare it to the output.

The image is built into an Alpine container and pushed to our Artifact Registry, so developers can run the docker-compose and avoid the environment issues around nsjail.

The idea of this is to keep the addition of new languages as simple as possible. To implement a new language:
- run `ldd $(which python)` for python or whatever language. Copy all dependencies and to the rootfs and the binary itself in the usr path.
- update the Language class with the file extension and the command to run files.
- write parsers for the testCase functionInput and expectedOutput. This is the meat of a new language implementation.
- update the if statement in write_code_to_file to include your language's printing of the solution(PARAMS), with the params being formatted to be valid by the parsers.
- update the if statement in the /execute endpoint to use your parser for the expectedOutput before comparing it to the actual output.