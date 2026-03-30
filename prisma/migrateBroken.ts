#!/usr/bin/env bun

import * as fs from "node:fs";

const readStream = fs.createReadStream("out.log", { encoding: "utf-8" });
const writeStream = fs.createWriteStream("test-cases.json", { flags: "a" });

let buffer = "";

readStream.on("data", (chunk) => {
  buffer += chunk;
});

readStream.on("end", () => {
  // Regex to extract JSON from code fences
  const codeFenceRegex = /(?<=^```json\r?\n)[\s\S]*?(?=^```)/gm;

  // Extract all code-fenced JSON blocks
  const matches = buffer.matchAll(codeFenceRegex);

  for (const match of matches) {
    const jsonContent = match[0].trim();
    if (jsonContent) {
      try {
        // Parse the JSON (should be an array of test cases)
        const parsed = JSON.parse(jsonContent);

        // If it's an array, loop over each test case
        if (Array.isArray(parsed)) {
          for (const test of parsed) {
            // Write each test with pretty formatting
            writeStream.write(JSON.stringify(test, null, 2));
            // Add comma and newline
            writeStream.write(",\n");
          }
        } else {
          // If it's a single object, write it directly
          writeStream.write(JSON.stringify(parsed, null, 2));
          writeStream.write(",\n");
        }
      } catch (err) {
        console.error(jsonContent);
        console.error("Failed to parse JSON block:", err);
        continue;
      }
    }
  }

  writeStream.end();
  console.log("Migration complete!");
});

readStream.on("error", (err) => {
  console.error("Read error:", err);
  process.exit(1);
});

writeStream.on("error", (err) => {
  console.error("Write error:", err);
  process.exit(1);
});
