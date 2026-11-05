# My dashboard setup

Personal customizations live on the `my-dashboard` branch. `master` tracks upstream MagicMirror.

## What's where

- `config/config.js.template`: the real config. **Edit this, not `config.js`.** `config.js` is regenerated from the template on every start.
- `config/config.env`: secrets (WMATA key, private iCal URLs, calendar ID). Gitignored; see `config.env.sample`.
- `modules/MMM-CaBiStatus`: my own module.
- `modules/MMM-WMATA`: copy of btoconnor/MMM-WMATA (upstream commit 7204681) with my style/template edits.
- `modules/MMM-CalendarExt3`, `modules/MMM-GoogleCalendar`: git submodules pointing at the original repos.

## Restore on a new machine

```bash
git clone --recurse-submodules -b my-dashboard https://github.com/aqnguyen97/MagicMirror.git
cd MagicMirror && npm run install-mm
(cd modules/MMM-CalendarExt3 && npm install) && (cd modules/MMM-GoogleCalendar && npm install)
cp config/config.env.sample config/config.env   # then fill in values
```

Google Calendar also needs `credentials.json`/`token.json` in `modules/MMM-GoogleCalendar` (not committed).

## Pull upstream updates

```bash
git remote add upstream https://github.com/MagicMirrorOrg/MagicMirror.git   # once
git fetch upstream && git checkout master && git merge upstream/master && git checkout my-dashboard && git merge master
```
