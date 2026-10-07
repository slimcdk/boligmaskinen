// Writes public/build-info.json: which version of the app is running, for builds without a backend.
// The fields are named like the OCI image labels. The image build passes the same values (VERSION,
// REVISION, SOURCE) to the backend, which serves them at api/version; locally they come from git.
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

function git(args) {
  try {
    return execSync(`git ${args}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}

/** git@github.com:owner/repo.git or https://github.com/owner/repo.git → https://github.com/owner/repo */
function webUrl(remote) {
  const match = /github\.com[:/](.+?)(\.git)?$/.exec(remote);
  return match ? `https://github.com/${match[1]}` : '';
}

const info = {
  version: process.env.VERSION || git('describe --tags --exact-match'),
  revision: process.env.REVISION || git('rev-parse HEAD'),
  source: process.env.SOURCE || webUrl(git('remote get-url origin')),
  created: new Date().toISOString(),
};
writeFileSync(new URL('../public/build-info.json', import.meta.url), JSON.stringify(info, null, 1) + '\n');
console.log('build-info:', info.version || info.revision.slice(0, 7) || 'local build');
