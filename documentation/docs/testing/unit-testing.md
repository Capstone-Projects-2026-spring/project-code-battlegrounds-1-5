---
sidebar_position: 1
---
# Unit tests
## Testing Library
1. Jest
2. Playwright
---
## Jest
Used for unit and integration testing of API endpoints and backend functionality.

### Modules:
- `jest` - Testing framework that runs tests in Node.js environment
- `ts-jest` - Enables seamless TypeScript support in Jest tests
- `@jest/globals` - Provides Jest globals like `describe`, `test`, `expect`, `beforeAll`

### How It's Used
- **API Testing**: Tests API endpoints by making HTTP requests and validating responses
- **Type Safety**: Imports and uses actual TypeScript types from the codebase for response validation
- **Parametrized Testing**: Uses `test.each()` to test multiple input combinations with a single test case
- **Async Support**: Full support for async/await when testing asynchronous operations

### Example
```typescript
import { beforeAll, describe, test, expect } from "@jest/globals";
import type { QuestionAPIResponse } from "@/pages/api/question";

test("ID=1", async () => {
  const json = await get({ id: "1" });
  expect(json.question?.questionId).toEqual(1);
});

// Parametrized tests for multiple scenarios
test.each(queryParamsCombinations)('$qps', async ({ qps }) => {
  const json = await get(qps);
  expect(json.question?.questionId).not.toBeNull();
})
```

### Test Location
`tests/api/*.spec.ts` - API integration tests

---

## Playwright
Used for end-to-end (E2E) testing of user workflows and browser interactions.

### Module:
- `@playwright/test` - Provides browser automation and E2E testing capabilities with built-in assertions

### How It's Used
- **User Flow Testing**: Tests complete user workflows like signup, login, and logout
- **UI Interaction**: Fills forms, clicks buttons, and navigates between pages
- **Element Selection**: Uses `data-testid` attributes to reliably select UI elements
- **Navigation Verification**: Confirms users are redirected to expected pages
- **Cleanup**: Makes API requests after tests to clean up test data

### Example
```typescript
import { test, expect } from "@playwright/test";

test("signup flow works", async ({ page }) => {
  await page.goto("/signup");
  await page.fill('[data-testid="email-signup"]', "user@test.com");
  await page.fill('[data-testid="password-signup"]', "password123");
  await page.click("button[data-testid='signup-button']");
  
  await expect(page).toHaveURL("/dashboard", { timeout: 15000 });
});
```

### Test Location
`tests/*.spec.ts` - E2E and integration tests


