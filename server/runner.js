const { spawn, execSync } = require('child_process');
const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

const languages = {
  javascript: {
    image: 'node:20-alpine',
    filename: 'main.js',
    run: 'node main.js',
  },
  python: {
    image: 'python:3.12-alpine',
    filename: 'main.py',
    run: 'python main.py',
  },
  cpp: {
    image: 'gcc:13-alpine',
    filename: 'main.cpp',
    run: 'g++ main.cpp -o main.out && ./main.out',
  },
};

async function runCode(lang, code, ws) {
  const config = languages[lang?.toLowerCase() || ''];
  if (!config) {
    ws.send(`Unsupported language: ${lang}`);
    return;
  }

  const jobId = randomUUID();
  const baseDir = path.join(os.tmpdir(), 'codebattlegrounds', jobId);
  fs.mkdirSync(baseDir, { recursive: true });

  const filePath = path.join(baseDir, config.filename);
  fs.writeFileSync(filePath, code, 'utf8');

  let useDocker = true;
  try {
    execSync('which docker', { stdio: 'ignore' });
  } catch (err) {
    useDocker = false;
  }

  const cleanup = () => {
    try {
      fs.rmSync(baseDir, { recursive: true, force: true });
    } catch (e) {
      console.error('cleanup error:', e);
    }
  };

  let processCommand;
  let args;
  let executionDescription;

  if (useDocker) {
    processCommand = 'docker';
    args = [
      'run',
      '--rm',
      '--network', 'none',
      '-m', '128m',
      '--cpus', '0.5',
      '-v', `${baseDir}:/app`,
      '-w', '/app',
      config.image,
      'sh',
      '-c',
      config.run,
    ];
    executionDescription = '[Runner] Starting Docker execution...';
  } else { // FOR TESTING ONLY. WHEN IN PRODUCTION DOCKER MUST BE USED.
    processCommand = 'sh';
    args = ['-c', config.run];
    executionDescription = '[Runner] Docker unavailable; using local runtime fallback...';
    executionDescription += '\n[Runner] WARNING: This fallback is not for production use.';
  }

  let timedOut = false;
  const proc = spawn(processCommand, args, {
    cwd: useDocker ? undefined : baseDir,
  });

  const timeout = setTimeout(() => {
    timedOut = true;
    proc.kill('SIGKILL');
    ws.send('[Runner] Process timed out (5s)');
    cleanup();
  }, 5000);

  ws.send(executionDescription);
  if (!useDocker) { //Another warning. This one doesnt have to be deleted.
    ws.send('[Runner] Warning: fallback is less secure than Docker \n');
  }

  proc.stdout.on('data', (chunk) => {
    const out = { stream: "stdout", data: chunk.toString() };
    ws.send(JSON.stringify(out));
  });

  proc.stderr.on('data', (chunk) => {
    const out = { stream: "stderr", data: chunk.toString() };
    ws.send(JSON.stringify(out));
  });

  proc.on('error', (err) => {
    clearTimeout(timeout);
    ws.send(`[Runner] Execution failed: ${err.message}`);
    cleanup();
  });

  proc.on('close', (code, signal) => {
    clearTimeout(timeout);

    if (timedOut) {
      return;
    }

    ws.send(`[Runner] Completed (exit ${code}${signal ? `, signal ${signal}` : ''})`);
    cleanup();
  });
}

module.exports = { runCode, languages };
