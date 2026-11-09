import test from "node:test";
import assert from "node:assert/strict";
import { roomListSignature } from "../../haiou-live/assets/js/room-list-signature.mjs";

const rooms = () => [
  {
    id: 12,
    title: "足球直播",
    category: "football",
    status: "offline",
    cover: "/uploads/room-12.jpg",
    sort: 2,
    anchorName: "主播甲",
    hostId: "h12",
    viewers: "0",
    quality: "高清"
  },
  {
    id: 7,
    title: "篮球直播",
    category: "basketball",
    status: "live",
    cover: "/uploads/room-7.jpg",
    sort: 1,
    anchorName: "主播乙",
    hostId: "h7",
    viewers: "0",
    quality: "高清"
  }
];

test("same rendered room data produces the same signature", () => {
  assert.equal(roomListSignature(rooms()), roomListSignature(rooms()));
});

test("status, title and cover changes produce a new signature", () => {
  const baseline = rooms();
  for (const change of [
    { status: "live" },
    { title: "更新后的标题" },
    { cover: "/uploads/new-cover.jpg" }
  ]) {
    const changed = rooms();
    changed[0] = { ...changed[0], ...change };
    assert.notEqual(roomListSignature(baseline), roomListSignature(changed));
  }
});

test("sort order and visible room order produce a new signature", () => {
  const baseline = rooms();
  const changedSort = rooms();
  changedSort[0].sort = 9;
  assert.notEqual(roomListSignature(baseline), roomListSignature(changedSort));
  assert.notEqual(roomListSignature(baseline), roomListSignature(baseline.slice().reverse()));
});

test("non-list input is handled safely", () => {
  assert.equal(roomListSignature(null), "");
  assert.equal(roomListSignature(undefined), "");
  assert.equal(roomListSignature([]), "");
});
