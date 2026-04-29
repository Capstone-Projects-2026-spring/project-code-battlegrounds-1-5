---
sidebar_position: 1
---
# Unit tests
## Testing Library
1. Jest
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
`tests/*.spec.ts` - unit and integration tests
`testse/*.spec.js` - websocket unit and integration tests


