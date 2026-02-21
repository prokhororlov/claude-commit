import * as vscode from 'vscode';
import { generateCommitMessage, ClaudeOptions, warmup, abortGeneration } from './claude';
import { getDiff, setCommitMessage } from './git';

const THINKING_WORDS = [
  'Reasoning...',
  'Analyzing...',
  'Pondering...',
  'Reflecting...',
  'Synthesizing...',
  'Considering...',
  'Examining...',
  'Evaluating...',
  'Deciphering...',
  'Contemplating...',
  'Interpreting...',
  'Distilling...',
];

const SPINNER = ['⠇', '⠋', '⠙', '⠸', '⢰', '⣠', '⣄', '⡆'];
const TYPE_SPEED = 60;
const ERASE_SPEED = 30;
const PAUSE_AFTER = 1200;

function getConfig(): ClaudeOptions {
  const cfg = vscode.workspace.getConfiguration('claudeCommit');
  return {
    model: cfg.get<string>('model', 'haiku'),
    claudePath: cfg.get<string>('claudePath', 'claude'),
  };
}

function startThinkingAnimation(set: (msg: string) => void): () => void {
  let stopped = false;
  let usedIndices: number[] = [];
  let spinFrame = 0;
  let currentText = '';

  const spinInterval = setInterval(() => {
    spinFrame++;
    set(`${SPINNER[spinFrame % SPINNER.length]} ${currentText}`);
  }, 80);

  function pickRandom(): string {
    if (usedIndices.length >= THINKING_WORDS.length) {
      usedIndices = [];
    }
    let idx: number;
    do {
      idx = Math.floor(Math.random() * THINKING_WORDS.length);
    } while (usedIndices.includes(idx));
    usedIndices.push(idx);
    return THINKING_WORDS[idx];
  }

  function render(text: string) {
    currentText = text;
  }

  async function loop() {
    while (!stopped) {
      const word = pickRandom();

      for (let i = 1; i <= word.length; i++) {
        if (stopped) { return; }
        render(word.slice(0, i));
        await sleep(TYPE_SPEED);
      }

      if (stopped) { return; }
      await sleep(PAUSE_AFTER);

      for (let i = word.length - 1; i >= 0; i--) {
        if (stopped) { return; }
        render(word.slice(0, i));
        await sleep(ERASE_SPEED);
      }

      if (stopped) { return; }
      render('');
      await sleep(100);
    }
  }

  loop();

  return () => {
    stopped = true;
    clearInterval(spinInterval);
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

export function activate(context: vscode.ExtensionContext) {
  try { warmup(getConfig().claudePath); } catch {}

  let stopAnimation: (() => void) | null = null;

  function setGenerating(value: boolean) {
    vscode.commands.executeCommand('setContext', 'claudeGenerating', value);
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('claude-commit.generate', async () => {
      try {
        const diff = await getDiff();
        if (!diff) {
          vscode.window.showWarningMessage('No changes found. Make some changes first.');
          return;
        }

        setGenerating(true);
        stopAnimation = startThinkingAnimation((msg) => setCommitMessage(msg));

        try {
          const options = getConfig();
          const message = await generateCommitMessage(diff, options);
          stopAnimation();
          stopAnimation = null;
          setGenerating(false);
          await setCommitMessage(message);
        } catch (err: unknown) {
          stopAnimation?.();
          stopAnimation = null;
          setGenerating(false);
          const msg = err instanceof Error ? err.message : String(err);

          if (msg.includes('abort')) {
            await setCommitMessage('');
            return;
          }

          await setCommitMessage('');
          vscode.window.showErrorMessage(`Claude Commit: ${msg}`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Claude Commit: ${msg}`);
      }
    }),

    vscode.commands.registerCommand('claude-commit.stop', () => {
      abortGeneration();
      stopAnimation?.();
      stopAnimation = null;
      setGenerating(false);
      setCommitMessage('');
    }),
  );
}

export function deactivate() {}
