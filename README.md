# dsh-fluid-chat-width

Fluid conversation width for the [DeepSeek Harness](https://github.com/deepseek-ai) web GUI.

The chat column stops being pinned to a fixed reading measure and follows the
window instead: **column width − 64px, capped at 1560px, floored at 640px**. No
settings page, no button — resize the window and the column tracks it.

## What it does

The DSH web client sizes its conversation column from a fixed measure and lets
the built-in drag handles override it with an inline
`--dsh-chat-user-width` on the conversation root. This plugin publishes that
same custom property from a `ResizeObserver` on the column, so:

- **Fluid by default** — the column is `min(columnWidth − 64, 1560)` on every
  resize, never narrower than the app's own 640px floor.
- **Drag handles still win** — a handle writes a deeper inline declaration, which
  legitimately overrides the published value. Dragging is unaffected; the value
  you drag to is what you get.
- **Stale preferences are cleared once per boot** — the client persists a fixed
  width in `localStorage["dsh.conversation.contentWidth"]`. On startup this
  plugin removes that key and strips any inline echo already published, so a
  leftover pinned width from an earlier drag cannot silently defeat it.

Embedded conversations are left alone: they define their own content width and
ignore `--dsh-chat-user-width`. Only the main chat region is targeted
(`[data-conversation-region="chat"] > [data-conversation-scroll]`).

## Tuning

The three constants live at the top of `apply()` in [`client.js`](client.js):

```js
const MARGIN = 64;  // total side breathing room (px)
const CAP    = 1560; // max content width (px)
const MIN    = 640;  // floor, matches the app's own CONTENT_MIN
```

They are compile-time constants rather than settings on purpose: this plugin has
no host half, no settings namespace, and nothing to persist. Edit and reload.

## Install

```sh
dsh plugin add dsh-fluid-chat-width
```

Or from a checkout:

```sh
dsh plugin add github:helloworld010234/dsh-fluid-chat-width
```

Restart the client afterwards.

## Uninstall

```sh
dsh plugin remove dsh-fluid-chat-width
```

If you had dragged a handle before installing, the preference key was cleared on
boot. Nothing else is left behind — the plugin writes no files, registers no
routes, and touches no storage except removing that one key.

## How it is built

Two faces, no build step, no runtime dependencies:

| File | Face | Role |
| --- | --- | --- |
| [`index.js`](index.js) | host (Node) | Deliberately empty. Satisfies the plugin shape so the bundle patch can mount the package into the web roster. |
| [`client.js`](client.js) | browser | The whole plugin: one `ResizeObserver`, one custom property. A hand-written `window.__ModuleLoader__.load` closure factory. |
| [`cordis.patch.yml`](cordis.patch.yml) | bundle patch | Inserts the `dsh.client` row into the profile's layer stack. |

There is no bundler and no transpiler — `client.js` ships as written, which is
why the source you read here is the source that runs.

## License

MIT
