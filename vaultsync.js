#!/usr/bin/env node
import simpleGit from 'simple-git';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const git = simpleGit(__dirname);
const LOG_FILE = path.join(__dirname, 'vaultsync.log');

function formatDate(date) {
  if (!date) return 'never';
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

function parseLogTimestamp(line) {
  const match = line.match(/^\[([\d\-T:\.Z]+)\]/);
  if (match) {
    return new Date(match[1]);
  }
  return null;
}

function getLastEventTime(eventType) {
  if (!fs.existsSync(LOG_FILE)) {
    return null;
  }

  const logContent = fs.readFileSync(LOG_FILE, 'utf-8');
  const lines = logContent.split('\n').reverse();

  for (const line of lines) {
    if (line.includes(eventType)) {
      return parseLogTimestamp(line);
    }
  }

  return null;
}

async function status() {
  console.log('Obsidian Vault Sync Status');
  console.log('===========================\n');

  const lastPush = getLastEventTime('Push completed successfully');
  const lastPull = getLastEventTime('Pull completed successfully');

  console.log(`Last push: ${formatDate(lastPush)}`);
  console.log(`Last pull: ${formatDate(lastPull)}`);
  console.log('');

  // Check for conflict files
  const conflictFiles = fs.readdirSync(__dirname)
    .filter(file => /\.conflict-\d{4}-\d{2}-\d{2}\./.test(file));

  if (conflictFiles.length > 0) {
    console.log('⚠ Conflict files detected:');
    conflictFiles.forEach(file => {
      console.log(`  - ${file}`);
    });
    console.log('\nReview these files and delete them once resolved.');
  } else {
    console.log('✓ No conflict files');
  }

  console.log('');

  // Git status
  const gitStatus = await git.status();
  if (gitStatus.isClean()) {
    console.log('✓ Working directory clean');
  } else {
    console.log('⚠ Uncommitted changes:');
    gitStatus.files.forEach(file => {
      console.log(`  ${file.working_dir} ${file.path}`);
    });
  }
}

const command = process.argv[2];

if (command === 'status') {
  status().catch(error => {
    console.error('Error:', error.message);
    process.exit(1);
  });
} else {
  console.log('Usage: vaultsync status');
  process.exit(1);
}
