# My dashboard setup

Personal customizations live on the `my-dashboard` branch. `master` tracks upstream MagicMirror.

## What's where

- `config/config.js.template`: the real config. **Edit this, not `config.js`.** `config.js` is regenerated from the template on every start.
- `config/config.env`: secrets (WMATA key, private iCal URLs). Gitignored; see `config.env.sample`.
- `modules/MMM-CaBiStatus`: my own module.
- `modules/MMM-WMATA`: copy of btoconnor/MMM-WMATA (upstream commit 7204681) with my style/template edits.
- `modules/MMM-CalendarExt3`: git submodule pointing at the original repo.

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
