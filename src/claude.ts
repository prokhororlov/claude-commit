import { spawn, ChildProcess } from 'child_process';

let warmedUp = false;

export function warmup(claudePath: string): void {
  if (warmedUp) { return; }
  warmedUp = true;

  const child = spawn(claudePath, ['--version'], {
    stdio: 'ignore',
    shell: true,
    timeout: 10_000,
  });

  child.on('error', () => { warmedUp = false; });
}

const COMMIT_RULES = `You are a git commit message generator. Rules:
1. Use conventional commits format: type(scope): description
2. Types: feat, fix, refactor, chore, docs, style, test, perf, ci, build
3. Keep the subject line under 72 characters
4. Be concise — describe WHAT changed, not WHY
5. Use imperative mood: "add feature" not "added feature"
6. Output ONLY the commit message, nothing else — no explanation, no reasoning
7. If changes span multiple areas, use the most impactful type
8. For scope, use the main module/component affected`;

const MAX_DIFF_CHARS = 300_000;

export interface ClaudeOptions {
  model: string;
  claudePath: string;
}

let currentChild: ChildProcess | null = null;

export function abortGeneration(): void {
  if (currentChild) {
    currentChild.kill();
    currentChild = null;
  }
}

export async function generateCommitMessage(
  diff: string,
  options: ClaudeOptions,
): Promise<string> {
  const truncatedDiff =
    diff.length > MAX_DIFF_CHARS
      ? diff.slice(0, MAX_DIFF_CHARS) + '\n\n... (diff truncated)'
      : diff;

  const userMessage = `${COMMIT_RULES}\n\nGenerate a commit message for this diff:\n\n${truncatedDiff}`;

  const raw = await runClaude(userMessage, options);
  const result = extractCommit(raw);
  return result.trim().replace(/^["'`]+|["'`]+$/g, '');
}

function runClaude(input: string, options: ClaudeOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = [
      '-p',
      '--model', options.model,
      '--no-session-persistence',
    ];

    const env = { ...process.env };
    delete env.CLAUDECODE;

    const child = spawn(options.claudePath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
      shell: true,
      timeout: 60_000,
    });

    currentChild = child;

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    child.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

    child.on('error', (err) => {
      currentChild = null;
      reject(new Error(`Claude CLI failed to start: ${err.message}`));
    });

    child.on('close', (code, signal) => {
      currentChild = null;
      if (signal) {
        reject(new Error('aborted'));
        return;
      }
      if (code !== 0) {
        reject(new Error(`Claude CLI exited with code ${code}\n${stderr}`));
        return;
      }
      resolve(stdout);
    });

    child.stdin.write(input);
    child.stdin.end();
  });
}

function extractCommit(text: string): string {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const pattern = /^(feat|fix|refactor|chore|docs|style|test|perf|ci|build)(\(.+?\))?:\s*.+/;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (pattern.test(lines[i])) {
      return lines[i];
    }
  }
  return lines[lines.length - 1] || text;
}
