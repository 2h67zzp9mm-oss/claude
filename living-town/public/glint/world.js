// Glint's Grid: the map. Glint edits this to grow his world.
// tiles: one string per row; each letter is a ground type from GROUND in things.js.
// things: what stands on the grid. kind is a key of THINGS in things.js. x, y are tile positions.
window.GLINT_WORLD = {
  size: 24,
  tiles: [],          // empty means every tile is plain grid
  things: []
};
