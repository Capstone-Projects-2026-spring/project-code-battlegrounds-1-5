#!/usr/bin/env node
const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const CLI_NAME = "create-project-docs";
const REPO_URL = "https://github.com/ApplebaumIan/tu-cis-4398-docs-template.git";

const run = (cmd) => {
  try {
    execSync(cmd, { stdio: "inherit" });
    return true;
  } catch (e) {
    console.error(`Failed: ${cmd}`);
    console.error(e?.message ?? e);
    return false;
  }
};

const usage = () => {
  console.log(`
Usage:
  npx ${CLI_NAME} add [--path <dir>] [--force] [--skip-install]
  npx ${CLI_NAME} new <project-name> [--force] [--skip-install]

What it does:
  Copies the template repo's /documentation folder into a target project.

Commands:
  add                 Add /documentation into an existing project (default: cwd)
  new <project-name>  Create a new directory, then add /documentation into it

Options:
  --path <dir>       Target project directory (add only; default: cwd)
  --force            Overwrite existing ./documentation (or existing project dir for "new")
  --skip-install     Do not run "yarn install" in documentation
  -h, --help         Show help

Examples:
  # Add docs to the current project
  npx ${CLI_NAME} add

  # Add docs to an existing project elsewhere
  npx ${CLI_NAME} add --path ../my-project

  # Create a new project with docs
  npx ${CLI_NAME} new my-project
`);
};

const args = process.argv.slice(2);
if (args.includes("-h") || args.includes("--help") || args.length === 0) {
  usage();
  process.exit(args.length === 0 ? 1 : 0);
}

const cmd = args[0];

const getArgValue = (flag) => {
  const i = args.indexOf(flag);
  if (i === -1) return null;
  return args[i + 1] ?? null;
};

const force = args.includes("--force");
const skipInstall = args.includes("--skip-install");

function ensureDirExists(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.statSync(dir).isDirectory()) {
    console.error(`Not a directory: ${dir}`);
    process.exit(1);
  }
}

function copyDocumentationInto(targetDir) {
  const destDocsDir = path.join(targetDir, "documentation");

  if (fs.existsSync(destDocsDir)) {
    if (!force) {
      console.error(
        `A "documentation" folder already exists at:\n  ${destDocsDir}\n` +
          `Refusing to overwrite. Re-run with --force to replace it.`
      );
      process.exit(1);
    }
    fs.rmSync(destDocsDir, { recursive: true, force: true });
  }

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cis4398-docs-"));
  const tmpRepoDir = path.join(tmpRoot, "template");

  console.log(`Cloning template into temp...`);
  if (!run(`git clone --depth 1 ${REPO_URL} "${tmpRepoDir}"`)) process.exit(1);

  const srcDocsDir = path.join(tmpRepoDir, "documentation");
  if (!fs.existsSync(srcDocsDir)) {
    console.error(`Template repo did not contain /documentation as expected.`);
    process.exit(1);
  }

  console.log(`Copying documentation -> ${destDocsDir}`);
  fs.cpSync(srcDocsDir, destDocsDir, { recursive: true });

  console.log(`Cleaning up temp...`);
  fs.rmSync(tmpRoot, { recursive: true, force: true });

  if (!skipInstall) {
    console.log(`Installing docs dependencies (yarn install)...`);
    if (!run(`cd "${destDocsDir}" && yarn install`)) process.exit(1);
  }

  console.log("\nDone! Next steps:");
  console.log(`  cd "${destDocsDir}"`);
  console.log(`  PROJECT_NAME=${path.basename(path.resolve(targetDir))} yarn start`);
}

// -------------------- Command routing --------------------

if (cmd === "add") {
  const targetDir = path.resolve(getArgValue("--path") || process.cwd());

  if (!fs.existsSync(targetDir)) {
    console.error(
      `Target directory does not exist:\n  ${targetDir}\n` +
        `If you want to create a new project directory, use:\n  npx ${CLI_NAME} new <project-name>`
    );
    process.exit(1);
  }

  ensureDirExists(targetDir);
  copyDocumentationInto(targetDir);
  process.exit(0);
}

if (cmd === "new") {
  const projectName = args[1];
  if (!projectName || projectName.startsWith("-")) {
    console.error(`Missing project name.\n`);
    usage();
    process.exit(1);
  }

  const targetDir = path.resolve(process.cwd(), projectName);

  if (fs.existsSync(targetDir)) {
    if (!force) {
      console.error(
        `Directory already exists:\n  ${targetDir}\n` +
          `Refusing to overwrite. Re-run with --force to use it anyway.`
      );
      process.exit(1);
    }
  } else {
    console.log(`Creating project directory: ${targetDir}`);
    fs.mkdirSync(targetDir, { recursive: true });
  }

  ensureDirExists(targetDir);
  copyDocumentationInto(targetDir);
  process.exit(0);
}

console.error(`Unknown command: ${cmd}\n`);
usage();
process.exit(1);