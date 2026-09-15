import type { StoredGraphic } from "./types";

const KEY = "graphics";
const MAX_STORED = 60;

export async function listGraphics(): Promise<StoredGraphic[]> {
  const data = await chrome.storage.local.get(KEY);
  const list = (data[KEY] as StoredGraphic[] | undefined) ?? [];
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveGraphic(graphic: StoredGraphic): Promise<void> {
  const list = await listGraphics();
  list.unshift(graphic);
  await chrome.storage.local.set({ [KEY]: list.slice(0, MAX_STORED) });
}

export async function deleteGraphic(id: string): Promise<void> {
  const list = await listGraphics();
  await chrome.storage.local.set({ [KEY]: list.filter((g) => g.id !== id) });
}
