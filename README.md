# Obsidian Vault Sync

Git-based sync for Obsidian vaults. Replaces Obsidian Sync with automatic commit/push on changes and periodic pulls with conflict resolution.

## Features

- **Auto-commit & push**: Debounces 30s after the last change, then commits and pushes
- **Periodic pulls**: Pulls with rebase every 5 minutes
- **Conflict resolution**: Never loses data—writes incoming version as `*.conflict-YYYY-MM-DD.md`, keeps yours in place
- **Status command**: Shows last push/pull time and any outstanding conflict files
- **Mobile support**: Use Working Copy (iOS) or MGit (Android) pointed at the same repo

## Setup

### First Machine

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Create a private GitHub repository** for your vault.

3. **Configure git credentials**:
   
   Option A: Use the system git credential helper (recommended):
   ```bash
   git config credential.helper store
   ```
   
   Option B: Use a personal access token in `.env`:
   ```bash
   cp .env.example .env
   # Edit .env and add your GitHub token
   ```

4. **Initialize and push**:
   ```bash
   git init
   git branch -M main
   git remote add origin https://github.com/yourusername/your-vault-repo.git
   git add .
   git commit -m "Initial commit"
   git push -u origin main
   ```

5. **Make vaultsync command available**:
   ```bash
   npm link
   ```

6. **Start the watcher**:
   ```bash
   npm start
   ```
   
   Or run it in the background:
   - **macOS/Linux**: Use a systemd service or launchd agent
   - **Windows**: Use Task Scheduler or run in a terminal

### Second Machine

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/your-vault-repo.git
   cd your-vault-repo
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure git credentials** (same as above).

4. **Make vaultsync command available**:
   ```bash
   npm link
   ```

5. **Start the watcher**:
   ```bash
   npm start
   ```

### Mobile Setup

#### iOS (Working Copy)

1. Install Working Copy from the App Store
2. Clone your private GitHub repository
3. Point Obsidian to the cloned folder
4. Commit and push changes manually or use Working Copy's automation

#### Android (MGit)

1. Install MGit from F-Droid or Play Store
2. Clone your private GitHub repository
3. Point Obsidian to the cloned folder
4. Commit and push changes manually

## Usage

### Check Status

```bash
vaultsync status
```

Shows:
- Last push time
- Last pull time
- Any conflict files that need review
- Current git status

### Conflict Resolution

When a conflict occurs:

1. The incoming version is saved as `filename.conflict-YYYY-MM-DD.md`
2. Your version stays as `filename.md`
3. Review both files
4. Merge changes manually
5. Delete the conflict file once resolved

Example:
```
My Note.md                    ← your version (kept)
My Note.conflict-2026-08-28.md ← incoming version (saved)
```

## What's Synced

- All Markdown files (`.md`)
- Attachments and other files in your vault
- `.obsidian/` config files **except** `workspace*` (device-local)

## What's NOT Synced

- `.obsidian/workspace*` (device-local window state)
- `.trash/` (local trash)
- `node_modules/`
- Sync system internals

## Architecture

- **watcher.js**: Watches for file changes, debounces, commits, and pushes. Pulls every 5 minutes.
- **vaultsync.js**: CLI for status checking
- **Conflict handling**: On merge conflict, saves incoming as `*.conflict-YYYY-MM-DD.md`, keeps yours
- **History**: Standard git log—no separate UI

## Out of Scope

- Encrypted vault workflow
- Version history UI (use `git log` or GitHub)
- Real-time sync (pulls every 5 minutes, pushes 30s after last change)

## Troubleshooting

### Authentication Fails

If pushes fail with authentication errors:

1. Check your GitHub token has `repo` scope
2. Verify token is in `.env` or system credential helper is configured
3. Test manually: `git push`

### Watcher Not Running

Check the log:
```bash
tail -f vaultsync.log
```

### Conflict Files Piling Up

Review and resolve them:
1. Open both versions
2. Merge changes into the main file
3. Delete the `.conflict-*.md` file
4. Commit the resolution

## License

MIT
