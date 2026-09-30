# Rain Alarm and UnWX

<<<<<<< Updated upstream
Rain radar and severe-weather warnings in one macOS app.

Use the floating **Rain radar / Severe weather** switcher to open Rain Alarm or [UnWX](https://www.unwx.app/pwa/). UnWX shows official warnings for severe weather, including storms, floods, heat, snow, and strong winds. Both sites retain their own settings in the existing Rain Alarm profile. The app remembers your last view when you reopen it.

Keyboard shortcuts: **⌘1** for rain radar, **⌘2** for severe weather, and **⌘R** to reload. The same views are available in the Weather menu.
=======
A small Electron app with one window and a map switcher.
>>>>>>> Stashed changes

Choose a map in the toolbar:

- **Rain Alarm** — live rain radar and approaching-rain alerts.
- **UnWX** — [Rain Alarm’s sister site](https://www.unwx.app/pwa/) for official severe-weather warnings.
- **Environment Canada** — Canadian radar and official weather alerts.
- **Windy** — wind, rain, temperature, and forecast models.
- **LightningMaps** — real-time lightning activity.

Maps load when first selected and retain their view while you switch. The app remembers your last selection. Reload retries a failed map; Open in browser opens the selected provider externally. Each provider keeps its own account, map settings, and location. Maps require an internet connection.

Rain Alarm’s existing browser permissions and automation apply only to Rain Alarm. Other maps can request location but do not receive the Rain Alarm preload or access to the local switcher. HTTPS certificate validation remains enabled for all providers.

For Rain Alarm, the app suppresses JavaScript dialogs, clicks positive or dismissive modal actions, provides an IP-based geolocation fallback, and reloads automatically when the refresh-timeout UI appears.

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

<<<<<<< Updated upstream
## Check and release

`npm run check` checks trusted site navigation and permission boundaries.
`npm run smoke` opens an isolated test profile, switches between both live maps,
checks the selected view, and confirms that reopening restores your selection.

Native ship-it hooks push the source. The tracked `.deploy-it.json` then hands
the exact pushed revision to Jenkins job `release-rain`, which builds and tests
on the Mac, publishes the signed arm64 ZIP to GitHub Releases, and verifies its
downloaded checksum and source revision. Jenkins also polls main for changes.
=======
## Verify

```sh
npm test
```

The Electron smoke test uses local fixtures to check all map choices, switching and retained state, renderer isolation, invalid inputs, load failure and retry, external links, minimum window width, and renderer cleanup. Provider availability is separate from this deterministic check.

## Delivery

Native ship-it hooks deliver completed work on `main` to `Leopere/rain-alarm-app`. Do not run the legacy `ship.sh` wrapper.

No GitHub Actions workflows are present. A Jenkins release job, its runtime, and an explicit artifact publication target remain unconfigured/unverified for this checkout. Local packaging creates an artifact; it does not publish a GitHub release.
>>>>>>> Stashed changes
