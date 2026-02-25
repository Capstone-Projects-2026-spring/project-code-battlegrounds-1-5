// permissions.ts - defines permissions associated with each role
export const ROLE_PERMISSIONS = {
  coder: [
    "writeCode",
    "readTests",
    "runCode"
  ],
  tester: [
    "writeTests",
    "readCode",
    "runTests"
  ],
  spectator: [
    "readCode",
    "readTests"
  ]
} as const;
