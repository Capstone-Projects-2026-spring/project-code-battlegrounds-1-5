// permissions.ts - defines permissions associated with each role
export const ROLE_PERMISSIONS = {
  coder: [
    "writeCode",
    "readTests",
    "runCode",
    "PresetChat" //Coder can only use preset messages in the chat
  ],
  tester: [
    "writeTests",
    "readCode",
    "runTests",
    "textChat", // Tester Can freetype in the text chat
    "QuestionVisibility" //Tester can see the question in the UI
  ],
  spectator: [
    "readCode",
    "readTests",
    "QuestionVisibility"
  ]
} as const;
