import { context, reddit, settings } from '@devvit/web/server';
import type { Widget } from '@devvit/web/server';

type SidebarConfig = {
  sourceSubreddit: string;
  subreddit: string;
  wikiPage: string;
  markerName: string;
  postCount: number;
  /** Blank disables the new-Reddit sidebar widget update. */
  widgetName: string;
};

async function getConfig(): Promise<SidebarConfig> {
  const [source, page, marker, count, widget] = await Promise.all([
    settings.get<string>('sourceSubreddit'),
    settings.get<string>('wikiPage'),
    settings.get<string>('markerName'),
    settings.get<number>('postCount'),
    settings.get<string>('widgetName'),
  ]);

  // The app account is only a moderator of the subreddit it's installed in, so
  // that's the only subreddit whose wiki it can edit.
  const subreddit = context.subredditName;
  if (!subreddit) {
    throw new Error('Could not determine the installed subreddit');
  }

  return {
    sourceSubreddit: source?.trim() || 'askTO',
    subreddit,
    wikiPage: page?.trim() || 'config/sidebar',
    markerName: marker?.trim() || 'hot-importer',
    postCount: count && count > 0 ? Math.floor(count) : 7,
    widgetName: widget?.trim() ?? '',
  };
}

function cleanTitle(title: string): string {
  return title
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"');
}

async function buildPostList(config: SidebarConfig): Promise<string> {
  const posts = await reddit
    .getHotPosts({
      subredditName: config.sourceSubreddit,
      // Fetch extras so stickied posts don't shrink the list below the target count
      limit: config.postCount + 5,
    })
    .all();

  let listText = '';
  let included = 0;
  for (const post of posts) {
    if (post.stickied) {
      continue;
    }
    const title = cleanTitle(post.title);
    listText += `1. [${title}](https://www.reddit.com${post.permalink})\r\n\r\n`;
    included += 1;
    if (included >= config.postCount) {
      break;
    }
  }

  if (included === 0) {
    throw new Error(`No non-stickied hot posts found in r/${config.sourceSubreddit}`);
  }

  return listText;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Same replacement region as the original Python bot, with a configurable
// marker name: everything between "[](/NAME-start)" and "[](/NAME-end)".
// The markers only need to be on their own lines; an empty region (the two
// markers on consecutive lines) is valid.
function spliceBetweenMarkers(
  sidebar: string,
  replacement: string,
  markerName: string
): string {
  const name = escapeRegExp(markerName);
  const markerRegex = new RegExp(
    `(\\[\\]\\(\\/${name}-start\\))[\\s\\S]*?(\\[\\]\\(\\/${name}-end\\))`
  );
  if (!markerRegex.test(sidebar)) {
    throw new Error(
      `Sidebar wiki page is missing the [](/${markerName}-start) / [](/${markerName}-end) markers`
    );
  }
  // Function replacement so "$" in post titles isn't treated as a pattern.
  // A blank line after the start marker is required: without it Reddit treats
  // the first list item as a lazy continuation of the marker's paragraph,
  // which breaks the indentation and restarts the numbering.
  return sidebar.replace(markerRegex, (_match, start: string, end: string) => {
    return `${start}\r\n\r\n${replacement}${end}`;
  });
}

// Old reddit: splice the list into the sidebar wiki page between the markers.
async function updateWikiSidebar(config: SidebarConfig, listText: string): Promise<void> {
  const wikiPage = await reddit.getWikiPage(config.subreddit, config.wikiPage);
  const updated = spliceBetweenMarkers(wikiPage.content, listText, config.markerName);

  if (updated === wikiPage.content) {
    console.log('Wiki sidebar already up to date; skipping edit');
    return;
  }

  await reddit.updateWikiPage({
    subredditName: config.subreddit,
    page: config.wikiPage,
    content: updated,
    reason: `update with the latest from r/${config.sourceSubreddit}`,
  });

  console.log(`Wiki sidebar of r/${config.subreddit} updated with:\n${listText}`);
}

// The widget classes are type-only exports, so `instanceof` isn't available at
// runtime; a string `text` property is what distinguishes a textarea widget.
function isTextAreaWidget(widget: Widget): widget is Widget & { text: string } {
  return typeof (widget as { text?: unknown }).text === 'string';
}

// New reddit (sh.reddit): keep a textarea widget in the sidebar in sync. The
// wiki page's markers are irrelevant here — the widget holds only our list, so
// its entire body is replaced.
async function updateWidgetSidebar(config: SidebarConfig, listText: string): Promise<void> {
  const widgets = await reddit.getWidgets(config.subreddit);
  const existing = widgets.find((widget) => widget.name === config.widgetName);

  if (!existing) {
    await reddit.addWidget({
      type: 'textarea',
      subreddit: config.subreddit,
      shortName: config.widgetName,
      text: listText,
    });
    // New widgets are appended to the bottom of the sidebar; a mod needs to
    // drag it into place once, after which updates preserve its position.
    console.log(
      `Created sidebar widget "${config.widgetName}" in r/${config.subreddit}. ` +
        'It was added at the bottom of the sidebar — reposition it in Mod Tools > Appearance.'
    );
    return;
  }

  if (!isTextAreaWidget(existing)) {
    throw new Error(
      `Sidebar widget "${config.widgetName}" in r/${config.subreddit} is not a text area widget; ` +
        'rename it or pick a different widget name'
    );
  }

  if (existing.text === listText) {
    console.log('Sidebar widget already up to date; skipping edit');
    return;
  }

  await reddit.updateWidget({
    type: 'textarea',
    subreddit: config.subreddit,
    id: existing.id,
    shortName: config.widgetName,
    text: listText,
  });

  console.log(`Sidebar widget "${config.widgetName}" of r/${config.subreddit} updated`);
}

export async function updateSidebar(): Promise<string> {
  const config = await getConfig();
  const listText = await buildPostList(config);

  await updateWikiSidebar(config, listText);

  if (config.widgetName) {
    await updateWidgetSidebar(config, listText);
  }

  return listText;
}
