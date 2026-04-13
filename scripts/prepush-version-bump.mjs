#!/usr/bin/env node

import { execSync } from 'node:child_process';
import console from 'node:console';
import process from 'node:process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ZERO_SHA = '0000000000000000000000000000000000000000';
const IGNORED_COMMIT_MESSAGE_PREFIX = 'chore(version): bump changed components';
const BUMP_LEVEL = {
  PATCH: 'patch',
  MINOR: 'minor',
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dryRun = process.argv.includes('--dry-run');

function runGit(command) {
  return execSync(`git ${command}`, {
    cwd: repoRoot,
    stdio: ['pipe', 'pipe', 'pipe'],
    encoding: 'utf8',
  }).trim();
}

function safeRunGit(command) {
  try {
    return runGit(command);
  } catch {
    return '';
  }
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readStdin() {
  try {
    return readFileSync(0, 'utf8').trim();
  } catch {
    return '';
  }
}

function shouldIgnoreFile(filePath) {
  const normalized = filePath.replaceAll('\\', '/');

  if (normalized.startsWith('docs/')) {
    return true;
  }

  if (normalized.startsWith('.github/workflows/')) {
    return true;
  }

  if (normalized.endsWith('.md')) {
    return true;
  }

  if (
    /(^|\/)tests?(\/|$)/.test(normalized) ||
    /(^|\/)__tests__(\/|$)/.test(normalized) ||
    /\.test\.[^.]+$/.test(normalized) ||
    /\.spec\.[^.]+$/.test(normalized)
  ) {
    return true;
  }

  return false;
}

function parseSemver(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);

  if (!match) {
    throw new Error(`Unsupported version format: ${version}`);
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function incrementVersion(version, bumpLevel) {
  const parsed = parseSemver(version);

  if (bumpLevel === BUMP_LEVEL.MINOR) {
    return `${parsed.major}.${parsed.minor + 1}.0`;
  }

  return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
}

function mergeBumpLevel(current, incoming) {
  if (current === BUMP_LEVEL.MINOR || incoming === BUMP_LEVEL.MINOR) {
    return BUMP_LEVEL.MINOR;
  }

  return BUMP_LEVEL.PATCH;
}

function bumpFromCommitSubject(subject) {
  return /^feat(\(.+\))?!?:/.test(subject) ? BUMP_LEVEL.MINOR : BUMP_LEVEL.PATCH;
}

function getWorkspaceDirectories() {
  const rootPackageJsonPath = path.join(repoRoot, 'package.json');
  const rootPackageJson = readJson(rootPackageJsonPath);
  const workspacePatterns = Array.isArray(rootPackageJson.workspaces)
    ? rootPackageJson.workspaces
    : [];

  const workspaceDirectories = [];

  workspacePatterns.forEach((workspacePattern) => {
    if (!workspacePattern.endsWith('/*')) {
      return;
    }

    const parentDirectory = workspacePattern.slice(0, -2);
    const absoluteParentDirectory = path.join(repoRoot, parentDirectory);

    readdirSync(absoluteParentDirectory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .forEach((entry) => {
        const relativePath = `${parentDirectory}/${entry.name}`;
        const packageJsonPath = path.join(repoRoot, relativePath, 'package.json');
        const packageJson = readJson(packageJsonPath);

        workspaceDirectories.push({
          name: packageJson.name,
          relativePath,
          packageJsonPath,
        });
      });
  });

  return workspaceDirectories.sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath)
  );
}

function getRangesFromPrePushInput(prePushInput) {
  if (!prePushInput) {
    return [];
  }

  return prePushInput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const [localRef, localSha, remoteRef, remoteSha] = line.split(/\s+/);
      return { localRef, localSha, remoteRef, remoteSha };
    })
    .filter((entry) => entry.localSha && entry.localSha !== ZERO_SHA)
    .map((entry) => {
      if (entry.remoteSha === ZERO_SHA) {
        const mergeBase = safeRunGit(`merge-base ${entry.localSha} origin/main`);

        if (mergeBase) {
          return `${mergeBase}..${entry.localSha}`;
        }

        return entry.localSha;
      }

      return `${entry.remoteSha}..${entry.localSha}`;
    });
}

function getCommitList(ranges) {
  const commits = new Set();

  ranges.forEach((range) => {
    const command = range.includes('..') ? `rev-list ${range}` : `rev-list ${range}^!`;
    const result = safeRunGit(command);

    result
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .forEach((line) => commits.add(line));
  });

  return [...commits];
}

function collectWorkspaceBumps(workspaces, commits) {
  const bumpsByWorkspacePath = new Map();

  commits.forEach((commitSha) => {
    const subject = safeRunGit(`log -1 --pretty=%s ${commitSha}`);

    if (subject.startsWith(IGNORED_COMMIT_MESSAGE_PREFIX)) {
      return;
    }

    const bumpLevel = bumpFromCommitSubject(subject);
    const changedFilesOutput = safeRunGit(`diff-tree --no-commit-id --name-only -r ${commitSha}`);
    const changedFiles = changedFilesOutput
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .filter((line) => !shouldIgnoreFile(line));

    const touchedWorkspacePaths = new Set();
    changedFiles.forEach((changedFile) => {
      const workspace = workspaces.find(
        (candidate) =>
          changedFile === candidate.relativePath ||
          changedFile.startsWith(`${candidate.relativePath}/`)
      );

      if (workspace) {
        touchedWorkspacePaths.add(workspace.relativePath);
      }
    });

    touchedWorkspacePaths.forEach((workspacePath) => {
      const currentBump = bumpsByWorkspacePath.get(workspacePath);
      bumpsByWorkspacePath.set(workspacePath, mergeBumpLevel(currentBump, bumpLevel));
    });
  });

  return bumpsByWorkspacePath;
}

function stageAndCommit(updatedWorkspacePaths, workspaceVersionsByName) {
  if (updatedWorkspacePaths.length === 0) {
    return;
  }

  const packageJsonTargets = updatedWorkspacePaths
    .map((workspacePath) => `${workspacePath}/package.json`)
    .join(' ');

  runGit(`add ${packageJsonTargets}`);

  const commitSummary = updatedWorkspacePaths
    .map((workspacePath) => {
      const workspaceName = workspaceVersionsByName.get(workspacePath)?.name;
      return workspaceName ?? workspacePath;
    })
    .join(', ');

  runGit(`commit -m "${IGNORED_COMMIT_MESSAGE_PREFIX}" -m "Updated: ${commitSummary}"`);
}

function main() {
  const prePushInput = readStdin();
  const ranges = getRangesFromPrePushInput(prePushInput);

  if (ranges.length === 0) {
    console.log('[pre-push version bump] No refs to evaluate.');
    return;
  }

  const workspaceDirectories = getWorkspaceDirectories();
  const commits = getCommitList(ranges);
  const bumpsByWorkspacePath = collectWorkspaceBumps(workspaceDirectories, commits);

  if (bumpsByWorkspacePath.size === 0) {
    console.log('[pre-push version bump] No qualifying component code changes detected.');
    return;
  }

  const plannedUpdates = [];

  workspaceDirectories.forEach((workspace) => {
    const bumpLevel = bumpsByWorkspacePath.get(workspace.relativePath);

    if (!bumpLevel) {
      return;
    }

    const packageJson = readJson(workspace.packageJsonPath);
    const nextVersion = incrementVersion(packageJson.version, bumpLevel);

    if (nextVersion === packageJson.version) {
      return;
    }

    plannedUpdates.push({
      relativePath: workspace.relativePath,
      packageJsonPath: workspace.packageJsonPath,
      currentVersion: packageJson.version,
      nextVersion,
      name: workspace.name,
      bumpLevel,
    });
  });

  if (plannedUpdates.length === 0) {
    console.log('[pre-push version bump] No version changes were required.');
    return;
  }

  plannedUpdates.sort((left, right) => {
    const leftWeight = left.relativePath.startsWith('packages/') ? 0 : 1;
    const rightWeight = right.relativePath.startsWith('packages/') ? 0 : 1;

    if (leftWeight !== rightWeight) {
      return leftWeight - rightWeight;
    }

    return left.relativePath.localeCompare(right.relativePath);
  });

  const summary = plannedUpdates
    .map((update) => `${update.name}@${update.nextVersion} (${update.bumpLevel})`)
    .join(', ');

  if (dryRun) {
    console.log(`[pre-push version bump] Dry run changes: ${summary}`);
    return;
  }

  plannedUpdates.forEach((update) => {
    const packageJson = readJson(update.packageJsonPath);
    packageJson.version = update.nextVersion;
    writeJson(update.packageJsonPath, packageJson);
  });

  const workspaceVersionsByName = new Map();
  const updatedWorkspacePaths = plannedUpdates.map((update) => update.relativePath);
  plannedUpdates.forEach((update) => {
    workspaceVersionsByName.set(update.relativePath, {
      name: update.name,
      version: update.nextVersion,
      bumpLevel: update.bumpLevel,
    });
  });

  stageAndCommit(updatedWorkspacePaths, workspaceVersionsByName);
  console.log(`[pre-push version bump] Committed: ${summary}`);
}

main();
