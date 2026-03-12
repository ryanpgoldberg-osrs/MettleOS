export function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function bossLabel(b) {
  return b.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export function skillLabel(s) {
  return cap(s);
}
