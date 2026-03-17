module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.spec.ts', '**/tests/**/*.spec.tsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['babel-jest', {}],
  },
};
