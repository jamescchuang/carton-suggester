// Stable color assignment for item names.
const PALETTE = [
  "#4f8cff", "#ff6b6b", "#34c759", "#ffb020", "#a06bff",
  "#22c5c5", "#ff7eb6", "#8bc34a", "#ff9f43", "#5c7cfa",
];

export function makeColorMap(names) {
  const map = {};
  let i = 0;
  for (const name of names) {
    if (!(name in map)) {
      map[name] = PALETTE[i % PALETTE.length];
      i += 1;
    }
  }
  return map;
}
