import { packager } from '@electron/packager';
import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import './ignore-temp-rmdir-eperm.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const output = await mkdtemp(path.join(tmpdir(), 'weather-map-windows-'));
const [appPath] = await packager({
  dir: root,
  name: 'Weather Map',
  executableName: 'Weather Map',
  platform: 'win32',
  arch: 'x64',
  out: output,
  tmpdir: false,
  appVersion: version,
  buildVersion: version,
  win32metadata: { ProductName: 'Weather Map', FileDescription: 'Weather Map' },
  download: { cacheRoot: path.join(homedir(), 'Library/Caches/electron') },
  ignore: [/^\/dist($|\/)/, /^\/release($|\/)/, /^\/\.tmp($|\/)/,
    /^\/\.git($|\/)/, /^\/build\/rain-alarm\.iconset($|\/)/],
});

await access(path.join(appPath, 'Weather Map.exe'));
await writeFile(path.join(appPath, 'START-HERE.txt'),
  'Weather Map for Windows\r\n\r\n' +
  'Extract the whole ZIP to a folder, then open Weather Map.exe.\r\n' +
  'Keep the other files in the same folder. An internet connection is required.\r\n' +
  'Choose a weather map from the Maps menu.\r\n');
const release = path.join(root, 'release');
await mkdir(release, { recursive: true });
const archive = path.join(release, 'Weather-Map-Windows.zip');
execFileSync('ditto', ['-c', '-k', '--keepParent', appPath, archive], { stdio: 'inherit' });
console.log(`Packaged ${archive} with Weather Map.exe (version ${version})`);
