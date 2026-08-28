#!/usr/bin/env node
import chokidar from 'chokidar';
import simpleGit from 'simple-git';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const git = simpleGit(__dirname);
const DEBOUNCE_MS = 30000; // 30 seconds
const PULL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const LOG_FILE = path.join(__dirname, 'vaultsync.log');

let debounceTimer = null;
let lastPush = null;
let lastPull = null;

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(logMessage.trim());
  fs.appendFileSync(LOG_FILE, logMessage);
}

function formatDate(date) {
  if (!date) return 'never';
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

async function handleConflict(filePath) {
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  const dir = path.dirname(filePath);
  const date = new Date().toISOString().slice(0, 10);
  const conflictPath = path.join(dir, `${base}.conflict-${date}${ext}`);

  // Read incoming version from git
  try {
    const incomingContent = await git.show([`MERGE_HEAD:${filePath}`]);
    fs.writeFileSync(path.join(__dirname, conflictPath), incomingContent);
    log(`CONFLICT: Saved incoming version to ${conflictPath}`);

    // Keep ours
    await git.checkout(['--ours', filePath]);
    await git.add(filePath);

    return conflictPath;
  } catch (error) {
    log(`ERROR handling conflict for ${filePath}: ${error.message}`);
    return null;
  }
}

async function pull() {
  try {
    log('Pulling changes...');
    const status = await git.status();

    if (!status.isClean()) {
      log('Working directory not clean, committing local changes first');
      await commit();
    }

    await git.pull(['--rebase']);
    lastPull = new Date();
    log('Pull completed successfully');
  } catch (error) {
    if (error.message.includes('conflict') || error.message.includes('CONFLICT')) {
      log('Merge conflict detected, resolving...');

      const status = await git.status();
      const conflicts = status.conflicted;

      for (const file of conflicts) {
        await handleConflict(file);
      }

      await git.raw(['rebase', '--continue']);
      lastPull = new Date();
      log('Conflicts resolved, rebase continued');
    } else {
      log(`Pull failed: ${error.message}`);
    }
  }
}

async function commit() {
  try {
    const status = await git.status();

    if (status.isClean()) {
      log('No changes to commit');
      return;
    }

    await git.add('.');
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    await git.commit(`Auto-sync ${timestamp}`);
    log('Changes committed');
  } catch (error) {
    log(`Commit failed: ${error.message}`);
  }
}

async function push() {
  try {
    await commit();

    log('Pushing changes...');
    await git.push();
    lastPush = new Date();
    log('Push completed successfully');
  } catch (error) {
    log(`Push failed: ${error.message}`);
  }
}

function schedulePush() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(async () => {
    await push();
    debounceTimer = null;
  }, DEBOUNCE_MS);

  log(`Change detected, push scheduled in ${DEBOUNCE_MS / 1000}s`);
}

async function init() {
  log('Starting Obsidian vault sync...');

  // Initial pull
  await pull();

  // Set up periodic pulls
  setInterval(pull, PULL_INTERVAL_MS);

  // Watch for file changes
  const watcher = chokidar.watch('.', {
    ignored: [
      /(^|[\/\\])\../,  // dotfiles
      /node_modules/,
      /\.git/,
      /\.obsidian\/workspace/,
      /\.trash/,
      /vaultsync\.log/,
      /\.conflict-\d{4}-\d{2}-\d{2}\./
    ],
    persistent: true,
    ignoreInitial: true,
    cwd: __dirname
  });

  watcher
    .on('add', (path) => {
      log(`File added: ${path}`);
      schedulePush();
    })
    .on('change', (path) => {
      log(`File changed: ${path}`);
      schedulePush();
    })
    .on('unlink', (path) => {
      log(`File deleted: ${path}`);
      schedulePush();
    })
    .on('error', (error) => {
      log(`Watcher error: ${error.message}`);
    });

  log('Watcher initialized');
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  log('Shutting down...');
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    await push();
  }
  process.exit(0);
});

init().catch((error) => {
  log(`Fatal error: ${error.message}`);
  process.exit(1);
});

export { lastPush, lastPull, log };
