# My dashboard setup

Personal customizations live on the `my-dashboard` branch. `master` tracks upstream MagicMirror.

## What's where

- `config/config.js.template`: the real config. **Edit this, not `config.js`.** `config.js` is regenerated from the template on every start.
- `config/config.env`: secrets (WMATA key, private iCal URLs). Gitignored; see `config.env.sample`.
- `css/custom.css`: dashboard layout (centered clock, two columns) and the weather card styling.
- `modules/MMM-WeekAgenda`: my own module. Vertical week calendar (expanded today + one row per day); gets events from the built-in `calendar` module.
- `modules/MMM-CaBiStatus`: my own module.
- `modules/MMM-ChoreDays`: my own module. One line above the calendar: "Take out trash tonight", "Trash pickup today", a holiday, or "Next up: …" (Tue + Fri trash, Tue recycling; pickups shift a day later after weekday federal and DC holidays).
- `modules/MMM-HealthStatus`: my own module. Wi-Fi/internet icon (signal bars on the Pi) and Pi CPU temperature, top-right corner.
- `modules/MMM-DashboardTweaks`: my own module. Small display fixes for other modules (e.g. "8 pm" instead of "8:00 pm" in the hourly weather).
- `modules/MMM-WMATA`: copy of btoconnor/MMM-WMATA (upstream commit 7204681) with my style/template edits and bus groups.
- `modules/MMM-CalendarExt3`: git submodule pointing at the original repo. Not used in the config anymore (replaced by MMM-WeekAgenda).

## Restore on a new machine

```bash
git clone --recurse-submodules -b my-dashboard https://github.com/aqnguyen97/MagicMirror.git
cd MagicMirror && npm run install-mm
(cd modules/MMM-CalendarExt3 && npm install)
cp config/config.env.sample config/config.env   # then fill in values
```

## Pull upstream updates

```bash
git remote add upstream https://github.com/MagicMirrorOrg/MagicMirror.git   # once
git fetch upstream && git checkout master && git merge upstream/master && git checkout my-dashboard && git merge master
```
