/**
 * Stable signature of the fields rendered in a live-room card.
 * Keep this focused on visible list data so player-only updates do not redraw grids.
 */
const ROOM_CARD_FIELDS = [
  "id",
  "title",
  "category",
  "status",
  "cover",
  "sort",
  "anchorName",
  "hostId",
  "viewers",
  "quality"
];

export function roomListSignature(rooms) {
  if (!Array.isArray(rooms)) return "";

  return rooms.map(room => ROOM_CARD_FIELDS
    .map(field => String(room && room[field] != null ? room[field] : ""))
    .join("\u0001")
  ).join("\u0002");
}
