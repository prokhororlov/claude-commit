# Claude Commit

AI-powered conventional commit message generator using Claude via [Claude Code](https://claude.com/claude-code) CLI — right from the Source Control panel.

![VS Code](https://img.shields.io/badge/VS%20Code-1.85+-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- **One-click generation** — Claude icon in the Source Control title bar
- **Cancel anytime** — click the stop icon to abort generation mid-flight
- **Conventional commits** — `feat:`, `fix:`, `refactor:`, `chore:`, etc.
- **Staged + unstaged** — uses staged changes first, falls back to unstaged
- **No API key needed** — uses your existing `claude auth` session
- **Model selection** — choose between Haiku, Sonnet, or Opus
- **Zero dependencies** — spawns Claude CLI, no SDKs

## Requirements

- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated (`claude auth login`)
- Git repository in the workspace

## Usage

1. Make changes to your code
2. Open Source Control panel (`Ctrl+Shift+G`)
3. Click the **Claude** icon in the panel header
4. Commit message appears in the input box

To cancel a running generation, click the **stop** icon that replaces the Claude icon during generation.

## Commands

| Command | Description |
|---------|-------------|
| `Claude: Generate Commit Message (Claude)` | Generate a commit message from current changes |
| `Claude: Stop Claude Generation` | Cancel running generation |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `claudeCommit.model` | `haiku` | Claude model (`haiku`, `sonnet`, `opus`) |
| `claudeCommit.claudePath` | `claude` | Path to Claude Code CLI executable |

## How It Works

1. Reads `git diff` (staged changes preferred, unstaged as fallback)
2. Spawns `claude -p --model haiku` as a child process
3. Pipes the diff via stdin
4. Extracts a conventional commit message from the output
5. Message is inserted into the SCM commit input box

No direct network requests — all API communication is handled by the Claude CLI internally.

## License

MIT
