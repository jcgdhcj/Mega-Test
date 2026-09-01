import { Collection } from 'discord.js';

export const snipeCache = new Collection();
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB RAM Cap

export function addSnipe(channelId, data) {
  const current = snipeCache.get(channelId) || [];
  current.unshift(data);

  if (current.length > 20) current.pop(); // Keep max 20 per channel
  snipeCache.set(channelId, current);

  enforceMemoryLimit();
}

function enforceMemoryLimit() {
  let totalBytes = 0;

  for (const [chanId, msgs] of snipeCache.entries()) {
    const size = Buffer.byteLength(JSON.stringify(msgs));
    totalBytes += size;

    if (totalBytes > MAX_BYTES) {
      // Drop oldest entries to stay under 5MB limit
      snipeCache.delete(chanId);
    }
  }
  }
