# Rain Alarm and UnWX

A small Electron app with one window and a map switcher.

Choose a map in the toolbar:

- **Rain Alarm** — live rain radar and approaching-rain alerts.
- **UnWX** — [Rain Alarm’s sister site](https://www.unwx.app/pwa/) for official severe-weather warnings.
- **Environment Canada** — Canadian radar and official weather alerts.
- **Windy** — wind, rain, temperature, and forecast models.
- **LightningMaps** — real-time lightning activity.

Maps load when first selected and retain their view while you switch. The app remembers your last selection. Reload retries a failed map; Links stay within the selected provider’s site; outside links and pop-up windows are blocked. Each provider keeps its own account, map settings, and location. Maps require an internet connection.

Rain Alarm’s existing browser permissions and automation apply only to Rain Alarm. UnWX can request location and notifications; the other maps can request location but do not receive the Rain Alarm preload or access to the local switcher. HTTPS certificate validation remains enabled for all providers.

For Rain Alarm, the app suppresses JavaScript dialogs, clicks positive or dismissive modal actions, provides an IP-based geolocation fallback, and reloads automatically when the refresh-timeout UI appears.

Use ⌘1–⌘5 or the Maps menu to switch maps, and ⌘R to reload the active map.

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

## Verify

```sh
npm test
```

The Electron smoke test uses local fixtures to check all map choices, switching and retained state, renderer isolation, invalid inputs, load failure and retry, blocked external links, minimum window width, and renderer cleanup. Provider availability is separate from this deterministic check.

## Delivery

Native ship-it hooks deliver completed work on `main` to `Leopere/rain-alarm-app`. Do not run the legacy `ship.sh` wrapper.

No GitHub Actions workflows are present. The tracked deployment contract targets Jenkins job `release-rain` and GitHub Releases; access and successful runs remain unverified from this Mac. Local packaging creates an artifact; it does not publish a GitHub release.
