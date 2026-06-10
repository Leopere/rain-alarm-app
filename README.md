# Rain Alarm Electron App

A small Electron wrapper for the Rain Alarm web app.

It opens `https://www.rain-alarm.com/` in its own app window and auto-allows Rain Alarm browser permissions such as location, notifications, fullscreen, clipboard access, file access, device pickers, and screen capture.

It also suppresses JavaScript dialogs, aggressively clicks positive or dismissive actions in Rain Alarm modal UI, provides an IP-based geolocation fallback when Electron's built-in geolocation service fails, and reloads automatically when Rain Alarm shows its refresh-timeout UI.

## Install

Download the latest `Rain-Alarm-macOS-Electron-arm64.zip` from the GitHub releases page, unzip it, and open `Rain Alarm.app`.

For local development, install dependencies:

```sh
npm install
```

Run the app from source:

```sh
npm start
```

Install a local build to `/Applications`:

```sh
./scripts/install.sh
```

The installed app is:

```text
/Applications/Rain Alarm.app
```

App data is stored in `~/Library/Application Support/Rain Alarm`.

macOS can still show operating-system privacy prompts. Those cannot be pre-approved by Electron, but browser and page-level prompts are handled by the app.

## Package

Create a release zip:

```sh
npm run package:release
```

The generated app and zip are written to `release/`.

## Ship

Commit and push the current branch:

```sh
./ship.sh "commit message"
```
