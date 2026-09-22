# hot-importer

A [Devvit](https://developers.reddit.com/docs) app that mirrors another
subreddit's hot posts into your sidebar. Every 15 minutes it pulls the hot posts
from a source subreddit (default: r/AskReddit) and splices them into the sidebar
wiki page (`config/sidebar`) of the subreddit it's installed in, between a
configurable pair of markers (default: `[](/hot-importer-start)` and
`[](/hot-importer-end)`).

It can optionally keep the same list in a new-Reddit (sh.reddit) sidebar
**text area widget**, since `config/sidebar` only renders on old Reddit. Set the
widget name to enable it; see [Configuration](#configuration).

Runs entirely on Reddit's infrastructure — no host, no credentials, no praw.ini.

## Configuration

Per-installation settings, editable by mods on the app's install settings page.
The target subreddit isn't configurable — the app account is only a moderator
of the subreddit it's installed in, so that's the only wiki it can edit.

| Setting | Default | Notes |
| --- | --- | --- |
| Source subreddit | `AskReddit` | Where hot posts are read from |
| Wiki page | `config/sidebar` | The page holding the sidebar markdown |
| Marker name | `hot-importer` | List goes between `[](/NAME-start)` and `[](/NAME-end)` |
| Number of posts | `7` | Stickied posts are skipped |
| Widget name | *(blank)* | Blank = old Reddit only. Set it to also update a new-Reddit sidebar widget |

### New Reddit sidebar widget

The old-reddit wiki page and the new-reddit widget are separate mechanisms;
`config/sidebar` simply isn't rendered on sh.reddit. Filling in **Widget name**
makes each run update both with the same list.

On the first run the app looks for a sidebar text area widget with that name
and creates it if absent. New widgets are appended to the **bottom** of the
sidebar, so reposition it once via *Mod Tools → Appearance → Widgets*; later
runs update it in place and preserve the position. You can also create the
widget yourself beforehand — an empty text area with a matching name is adopted
as-is.

Unlike the wiki page, the widget holds nothing but the imported list, so no
markers are involved; its whole body is replaced each run. If the name matches
a widget that isn't a text area, the run fails with an error rather than
overwriting it.

## Development

```sh
npm install
npm run login      # devvit login (first time only)
npm run dev        # devvit playtest on a test subreddit
npm run deploy     # type-check + devvit upload
```

A moderator menu action ("Update sidebar now") triggers an immediate update
without waiting for the 15-minute cron.

## Credits

The concept goes back to Deimorz's "hot sister" script ("hot" being the hot
listing); this is an independent reimplementation of the idea, not a copy of
that code.

## License

[MIT](LICENSE) © 2026 Eric Logan
