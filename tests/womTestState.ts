// Test access stays outside the Next.js route export surface.
const state = globalThis as typeof globalThis & {
  __mettleWomCache__?: Map<string, unknown>;
  __mettleWomInflight__?: Map<string, unknown>;
};
export function __resetWomCacheForTests() {
  state.__mettleWomCache__?.clear();
  state.__mettleWomInflight__?.clear();
}
export function __getWomCacheSizeForTests() {
  return state.__mettleWomCache__?.size ?? 0;
}
