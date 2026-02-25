// Tests the question API endpoint
// Next server must be running on port 8080 to run properly

const BASE_URL = "http://localhost:8080";

// Tests whether the server is actually running. Will fail early if not.
beforeAll(async () => {
  const res = await fetch(`${BASE_URL}/api/hello`);
  expect(res.ok).toBeTruthy();
});



