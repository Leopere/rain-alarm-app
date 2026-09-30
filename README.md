# Rain Alarm and UnWX

Rain radar and severe-weather warnings in one macOS app.

Use the floating **Rain radar / Severe weather** switcher to open Rain Alarm or [UnWX](https://www.unwx.app/pwa/). UnWX shows official warnings for severe weather, including storms, floods, heat, snow, and strong winds. Both sites retain their own settings in the existing Rain Alarm profile. The app remembers your last view when you reopen it.

Keyboard shortcuts: **⌘1** for rain radar, **⌘2** for severe weather, and **⌘R** to reload. The same views are available in the Weather menu.

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

UnWX can use location and notifications; it is not granted screen capture or device access.

macOS can still show operating-system privacy prompts. Those cannot be pre-approved by Electron, but browser and page-level prompts are handled by the app.

## Package

Create a release zip:

```sh
npm run package:release
```

The generated app and zip are written to `release/`.

## Check and release

`npm run check` checks trusted site navigation and permission boundaries.
`npm run smoke` opens an isolated test profile, switches between both live maps,
checks the selected view, and confirms that reopening restores your selection.

Native ship-it hooks push the source. The tracked `.deploy-it.json` then hands
the exact pushed revision to Jenkins job `release-rain`, which builds and tests
on the Mac, publishes the signed arm64 ZIP to GitHub Releases, and verifies its
downloaded checksum and source revision. Jenkins also polls main for changes.
