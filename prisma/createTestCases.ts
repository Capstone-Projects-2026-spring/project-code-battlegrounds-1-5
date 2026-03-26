#!/usr/bin/env bun

import Anthropic from "@anthropic-ai/sdk";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Problem } from "@prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({
  adapter,
});

// top-level await unnnnggggggggghhhhhhh
const problems = await prisma.problem.findMany({
  select: {
    id: true,
    slug: true,
    title: true,
    description: true
  }
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

for (const problem of problems.slice(0, 3)) {
  // Replace placeholders like {{problemText}} with real values,
  // because the SDK does not support variables.
  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 20000,
    temperature: 1,
    system: `You are a test case generator for a coding platform similar to LeetCode. Your task is to generate exactly 3 test cases for a given coding problem.\n\nHere is the problem you need to generate test cases for:\n\n<problem_text>\n${problem.title}}\n</problem_text>\n\n<problem_id>\n${problem.slug}\n</problem_id>\n\n<programming_language>\njavascript\n</programming_language>\n\n## Understanding the Parameter Structure\n\nEach test case input and output uses Parameter objects with this structure:\n- \`name\`: string (the parameter name)\n- \`type\`: one of these exact values: \`string\", \"number\", \"array_string\", \"array_number\", or \"boolean\"\n- \`value\`: string (the actual value, represented as a string that will be coerced to the correct type)\n\n## Your Task\n\nGenerate exactly 3 test cases for this problem. Each test case should:\n1. Test different aspects or edge cases of the problem\n2. Vary in complexity (e.g., simple case, medium case, more complex case)\n3. Have valid inputs and correct expected outputs\n\nEach test case object must contain:\n- \`problemID\`: string (must exactly match the problem_id provided above)\n- \`functionInput\`: array of Parameter objects representing the function inputs\n- \`expectedOutput\`: array of Parameter objects representing the expected outputs\n- \`language\`: string (must exactly match the programming_language provided above)\n- \`optimalTimeMs\`: integer (estimated optimal execution time in milliseconds for this language)\n\n## Critical Output Requirements\n\nYour output will be passed DIRECTLY into a JSON parser. This means:\n\n1. Output ONLY the raw JSON array\n2. Do NOT wrap your output in markdown code fences (no \`\`\`json or \`\`\` anywhere)\n3. Do NOT add any explanatory text before or after the JSON\n4. Do NOT format for human display - this is for machine parsing only\n5. Start your output immediately with the opening bracket \`[\` of the JSON array\n6. Use proper JSON formatting with 2-space indentation (like JSON.stringify(data, null, 2))\n\nRemember: output your final JSON array directly, starting with \`[\` and ending with \`]\`. If you wrap your final output in anything other than valid JSON tokens, the JSON parser will fail and the program will crash. It cannot be stressed enough: if you include \"\`\`\`\" ANYWHERE in your final output, the output will fail. You cannot, under ANY circumstances, include \"\`\`\`\" in your output. Ensure the string \"\`\`\`\" is NEVER found AT ALL in your output.`,
    messages: [
      {
        "role": "user",
        "content": [
          {
            "type": "text",
            "text": "<examples>\n<example>\n<example_description>\nThis response was good because the output was not wrapped in a code fence. The output was good because the string \"```\" did not appear anywhere in the output.\n</example_description>\n<problemText>\nGiven an array of integers nums, return true if any value appears at least twice in the array, and return false if every element is distinct. For example, if nums = [1,2,3,1], the function should return true because 1 appears twice. If nums = [1,2,3,4], the function should return false because all elements are unique.\n</problemText>\n<problemID>\nfind-median\n</problemID>\n<problemLanguage>\njavascript\n</problemLanguage>\n<ideal_output>\n[\n  {\n    \"problemID\": \"find-median\",\n    \"functionInput\": [\n      {\n        \"name\": \"nums\",\n        \"type\": \"array_number\",\n        \"value\": \"[1,2,3,1]\"\n      }\n    ],\n    \"expectedOutput\": [\n      {\n        \"name\": \"result\",\n        \"type\": \"boolean\",\n        \"value\": \"true\"\n      }\n    ],\n    \"language\": \"javascript\",\n    \"optimalTimeMs\": 10\n  },\n  {\n    \"problemID\": \"find-median\",\n    \"functionInput\": [\n      {\n        \"name\": \"nums\",\n        \"type\": \"array_number\",\n        \"value\": \"[1,2,3,4]\"\n      }\n    ],\n    \"expectedOutput\": [\n      {\n        \"name\": \"result\",\n        \"type\": \"boolean\",\n        \"value\": \"false\"\n      }\n    ],\n    \"language\": \"javascript\",\n    \"optimalTimeMs\": 10\n  },\n  {\n    \"problemID\": \"find-median\",\n    \"functionInput\": [\n      {\n        \"name\": \"nums\",\n        \"type\": \"array_number\",\n        \"value\": \"[5,10,15,20,25,30,10,35]\"\n      }\n    ],\n    \"expectedOutput\": [\n      {\n        \"name\": \"result\",\n        \"type\": \"boolean\",\n        \"value\": \"true\"\n      }\n    ],\n    \"language\": \"javascript\",\n    \"optimalTimeMs\": 10\n  }\n]\n</ideal_output>\n</example>\n<example>\n<example_description>\nThis response was good because the output was not wrapped in a code fence. The output was good because the string \"```\" did not appear anywhere in the output.\n</example_description>\n<problemText>\nGiven an array of integers, return the two numbers such that they add up to a specific target number. You may assume that each input would have exactly one solution, and you may not use the same element twice. The function should return an array containing the indices of the two numbers in ascending order. For example, given nums = [2, 7, 11, 15] and target = 9, the function should return [0, 1] because nums[0] + nums[1] equals 9.\n</problemText>\n<problemID>\ntwo-sum\n</problemID>\n<problemLanguage>\njavascript\n</problemLanguage>\n<ideal_output>\n[\n  {\n    \"problemID\": \"two-sum\",\n    \"functionInput\": [\n      {\n        \"name\": \"nums\",\n        \"type\": \"array_number\",\n        \"value\": \"[2, 7, 11, 15]\"\n      },\n      {\n        \"name\": \"target\",\n        \"type\": \"number\",\n        \"value\": \"9\"\n      }\n    ],\n    \"expectedOutput\": [\n      {\n        \"name\": \"result\",\n        \"type\": \"array_number\",\n        \"value\": \"[0, 1]\"\n      }\n    ],\n    \"language\": \"javascript\",\n    \"optimalTimeMs\": 10\n  },\n  {\n    \"problemID\": \"two-sum\",\n    \"functionInput\": [\n      {\n        \"name\": \"nums\",\n        \"type\": \"array_number\",\n        \"value\": \"[3, 2, 4]\"\n      },\n      {\n        \"name\": \"target\",\n        \"type\": \"number\",\n        \"value\": \"6\"\n      }\n    ],\n    \"expectedOutput\": [\n      {\n        \"name\": \"result\",\n        \"type\": \"array_number\",\n        \"value\": \"[1, 2]\"\n      }\n    ],\n    \"language\": \"javascript\",\n    \"optimalTimeMs\": 10\n  },\n  {\n    \"problemID\": \"two-sum\",\n    \"functionInput\": [\n      {\n        \"name\": \"nums\",\n        \"type\": \"array_number\",\n        \"value\": \"[1, 5, 3, 8, 12, 7, 2, 9]\"\n      },\n      {\n        \"name\": \"target\",\n        \"type\": \"number\",\n        \"value\": \"11\"\n      }\n    ],\n    \"expectedOutput\": [\n      {\n        \"name\": \"result\",\n        \"type\": \"array_number\",\n        \"value\": \"[1, 6]\"\n      }\n    ],\n    \"language\": \"javascript\",\n    \"optimalTimeMs\": 10\n  }\n]\n</ideal_output>\n</example>\n</examples>\n\n"
          },
          {
            "type": "text",
            "text": `{\n  problem: \`${problem.title}\`,\n  id: \"${problem.slug}\"\n}`
          }
        ]
      }
    ],
    thinking: {
      "type": "disabled"
    }
  });
  // console.log(msg);
  for(const content of msg.content) {
    if(content.type !== "text") continue;
    const parsed = JSON.parse(content.text);
    console.log(content.text);
    console.log(parsed);
  }
}
