const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function isBlockedTempRmdir(error) {
  if (error?.code !== 'EPERM' || error?.syscall !== 'rmdir') return false;
  const target = path.resolve(String(error.path || ''));
  return target.startsWith(path.resolve(os.tmpdir()) + path.sep);
}

function isTempPath(value) {
  return path.resolve(String(value || '')).startsWith(path.resolve(os.tmpdir()) + path.sep);
}

function patchFs(target) {
  const originalRm = target.promises?.rm?.bind(target.promises);
  if (originalRm) {
    target.promises.rm = async (...args) => {
      try {
        return await originalRm(...args);
      } catch (error) {
        if (isBlockedTempRmdir(error)) return undefined;
        throw error;
      }
    };
  }

  const originalRename = target.promises?.rename?.bind(target.promises);
  const copy = target.promises?.cp?.bind(target.promises) || fs.promises.cp.bind(fs.promises);
  if (originalRename) {
    target.promises.rename = async (from, to) => {
      try {
        return await originalRename(from, to);
      } catch (error) {
        if (error?.code !== 'EPERM' || error?.syscall !== 'rename' || !isTempPath(from) || !isTempPath(to)) {
          throw error;
        }

        await copy(from, to, { recursive: true, force: false, errorOnExist: true, verbatimSymlinks: true });
        return undefined;
      }
    };
  }
}

patchFs(fs);

try {
  patchFs(require('graceful-fs'));
} catch {
  // Packaging can run before graceful-fs is available.
}
