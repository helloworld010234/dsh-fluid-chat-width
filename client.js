/**
 * dsh-fluid-chat-width — browser half. (v4: fluid publisher + legacy preference takeover)
 *
 * A client-side cordis plugin: exports { name, apply }. The loader mounts the
 * browser half as a plugin, so the factory MUST return a function or an object
 * with an "apply" method (an empty exports object fails plugin validation and
 * kills web boot — the 2026-10-22 crash).
 *
 * Root cause this fixes: the app persists a fixed width preference in
 * localStorage["dsh.conversation.contentWidth"] (written by the built-in drag
 * handles). On boot it publishes that value as an INLINE
 * --dsh-chat-user-width on the conversation root — an inline declaration at
 * that depth beats any inherited value, which is why the column stayed pinned
 * (a stale 640px preference) no matter how wide the window was.
 *
 * Takeover semantics (explicit, once per boot):
 *   - remove the stale preference key (this plugin's whole purpose is fluid
 *     width; a leftover pinned value contradicts it);
 *   - strip any already-published inline --dsh-chat-user-width from the
 *     conversation root and its parent, so the fluid publisher below wins;
 *   - afterwards the app's own publishWidths() reads a null preference and
 *     removes (never re-writes) the inline property — the state stays clean
 *     until the user explicitly drags a handle again, which writes a deeper
 *     inline value that legitimately overrides this plugin (manual mode).
 */
window.__ModuleLoader__.load({
  id: "dsh-fluid-chat-width",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

    exports.name = "dsh-fluid-chat-width";

    exports.apply = function apply(ctx) {
      const PREF_KEY = "dsh.conversation.contentWidth";
      const MARGIN = 64;  // total side breathing room (px) — tune me
      const CAP = 1560;   // max content width (px) — tune me
      const MIN = 640;    // floor, matches the app's own CONTENT_MIN

      /* --- takeover: clear the stale pinned preference and its inline echo --- */
      try { localStorage.removeItem(PREF_KEY); } catch {}

      const stripInline = (el) => {
        if (el == null) return;
        const v = el.style?.getPropertyValue?.("--dsh-chat-user-width");
        if (v) el.style.removeProperty("--dsh-chat-user-width");
      };

      let convBody = null; // element whose width is the conversation column
      let ro = null;       // ResizeObserver watching it
      let lastW = -1;

      const publish = () => {
        if (convBody === null) return;
        const w = Math.max(MIN, Math.min(convBody.offsetWidth - MARGIN, CAP));
        if (w === lastW) return;
        lastW = w;
        document.body.style.setProperty("--dsh-chat-user-width", w + "px");
      };

      const attach = (el) => {
        if (el === convBody) return;
        if (ro !== null) ro.disconnect();
        convBody = el;
        lastW = -1;
        if (el === null) {
          document.body.style.removeProperty("--dsh-chat-user-width");
          return;
        }
        ro = new ResizeObserver(publish);
        ro.observe(el);
        publish();
      };

      const sync = () => {
        // Prefer the main chat region; embedded conversations define their own
        // content width and ignore --dsh-chat-user-width.
        let scroll =
          document.querySelector('[data-conversation-region="chat"] > [data-conversation-scroll]') ||
          document.querySelector("[data-conversation-scroll]");
        if (scroll === null) { attach(null); return; }
        // takeover: strip inline width the app may have published on the root
        // (root = scroll's parent) and on the root's parent before attaching.
        stripInline(scroll.parentElement);
        if (scroll.parentElement !== null) stripInline(scroll.parentElement.parentElement);
        attach(scroll.parentElement);
      };

      const mo = new MutationObserver(sync);
      mo.observe(document.documentElement, { childList: true, subtree: true });
      sync();
    };

    return module.exports;
  },
});
