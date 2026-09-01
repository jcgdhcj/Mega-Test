import { Collection } from 'discord.js';

export const snipeCache = new Collection();
const MAX_BYTES = 10 * 1024 * 1024; // Change '5' here to adjust MB cap

export function addSnipe(channelId, data) {
  const current = snipeCache.get(channelId) || [];
  current.unshift(data);

  if (current.length > 20) current.pop();
  snipeCache.set(channelId, current);

  enforceMemoryCap();
}

export function clearSnipe(channelId) {
  snipeCache.delete(channelId);
}

function enforceMemoryCap() {
  let totalBytes = 0;
  for (const [chanId, msgs] of snipeCache.entries()) {
    const size = Buffer.byteLength(JSON.stringify(msgs));
    totalBytes += size;
    if (totalBytes > MAX_BYTES) {
      snipeCache.delete(chanId);
    }
  }
  }
