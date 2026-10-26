/**
 * dsh-fluid-chat-width — host half (intentionally empty).
 *
 * All behavior lives in the browser half (./client.js): one injected style
 * rule. This module only satisfies the plugin shape so the bundle patch can
 * mount the package into the web roster.
 */
export const name = "dsh-fluid-chat-width";

export function apply(ctx) {
  /* no host-side behavior */
}
