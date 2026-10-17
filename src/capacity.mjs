import { statfs } from 'node:fs/promises';
import { GiB, MiB } from './config.mjs';
import { fail } from './security.mjs';
import { settings, transaction } from './database.mjs';

// Binary units, matching the rest of the panel: 1 GB = 1,024 MB and 1 TB = 1,024 GB.
export const UNIT_BYTES = { MB: MiB, GB: GiB, TB: GiB * 1024 };
const MAX_CAPACITY = GiB * 1024 * 1024; // 1 PB sanity ceiling

export function unitBytes(unit) {
  const bytes = UNIT_BYTES[String(unit || '').trim().toUpperCase()];
  if (!bytes) fail(400, 'Choose MB, GB or TB.');
  return bytes;
}

// Accepts "500", "500GB", "1.5 TB", "2048 mb", "500 GiB". A bare number uses defaultUnit.
export function parseSize(input, defaultUnit = 'GB') {
  const match = /^\s*(\d+(?:[.,]\d+)?)\s*([a-z]*)\s*$/i.exec(String(input ?? ''));
  if (!match) fail(400, 'Enter a size such as 500 GB, 1.5 TB or 2048 MB.');
  let unit = match[2].toUpperCase().replace(/I?B$/, '') || defaultUnit.toUpperCase().replace(/I?B$/, '');
  unit += 'B';
  const bytes = Math.round(Number(match[1].replace(',', '.')) * unitBytes(unit));
  if (!Number.isSafeInteger(bytes) || bytes < MiB || bytes > MAX_CAPACITY) fail(400, 'Capacity must be between 1 MB and 1,048,576 GB.');
  return bytes;
}

export function formatSize(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const n = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 5);
  return `${(bytes / 1024 ** n).toFixed(n > 1 ? 2 : 0)} ${units[n]}`;
}

export async function scanDisk(dataDir) {
  const disk = await statfs(dataDir);
  return { total: disk.blocks * disk.bsize, used: (disk.blocks - disk.bfree) * disk.bsize, free: disk.bavail * disk.bsize };
}

function cloudBytes(db) { return db.prepare("SELECT COALESCE(SUM(size),0) AS bytes FROM entries WHERE kind='file'").get().bytes; }
function pendingBytes(db) { return db.prepare("SELECT COALESCE(SUM(size),0) AS bytes FROM upload_sessions WHERE state='pending'").get().bytes; }

// Synchronous check used by upload paths. Auto mode has no pool limit (the real disk check still applies).
export function poolRoom(db, extraReserved = 0) {
  const s = settings(db);
  if (s.storageMode !== 'custom') return Infinity;
  return s.storageCapacity - cloudBytes(db) - pendingBytes(db) - extraReserved;
}

export async function setStorage(db, dataDir, { mode, bytes }) {
  if (!['auto', 'custom'].includes(mode)) fail(400, 'Storage mode must be auto or custom.');
  let capacity = 0;
  if (mode === 'custom') {
    if (!Number.isSafeInteger(bytes)) fail(400, 'Enter the capacity as a number.');
    const used = cloudBytes(db) + pendingBytes(db), disk = await scanDisk(dataDir);
    if (bytes < used) fail(400, `Capacity cannot be lower than the ${formatSize(used)} already stored or reserved.`);
    if (bytes > used + disk.free) fail(400, `Only ${formatSize(used + disk.free)} is available on this server's disk (${formatSize(disk.free)} free). Choose a smaller size or Auto detect.`);
    capacity = bytes;
  }
  transaction(db, () => {
    const update = db.prepare('UPDATE settings SET value=? WHERE key=?');
    update.run(JSON.stringify(mode), 'storageMode');
    update.run(JSON.stringify(capacity), 'storageCapacity');
    update.run(JSON.stringify(true), 'storageConfigured');
  });
  return { mode, capacity };
}

// Full picture for the administrator "Disk & storage" page and the CLI.
export async function diskReport(db, dataDir) {
  const s = settings(db), disk = await scanDisk(dataDir);
  const cloud = cloudBytes(db), reserved = pendingBytes(db);
  const usable = cloud + disk.free; // the most this cloud could ever hold on this disk
  const capacity = s.storageMode === 'custom' ? s.storageCapacity : usable;
  const pending = new Map(db.prepare("SELECT user_id, COALESCE(SUM(size),0) AS bytes FROM upload_sessions WHERE state='pending' GROUP BY user_id").all().map(r => [r.user_id, r.bytes]));
  const users = db.prepare(`SELECT u.id, u.username, u.display_name, u.role, u.active, u.quota,
      COALESCE(SUM(CASE WHEN e.kind='file' THEN e.size END),0) AS used,
      COALESCE(SUM(CASE WHEN e.kind='file' AND e.deleted_at IS NOT NULL THEN e.size END),0) AS trash,
      COUNT(CASE WHEN e.kind='file' AND e.deleted_at IS NULL THEN 1 END) AS files
    FROM users u LEFT JOIN entries e ON e.user_id=u.id GROUP BY u.id ORDER BY used DESC, u.created_at LIMIT 2000`).all()
    .map(u => ({ id: u.id, username: u.username, displayName: u.display_name, role: u.role, active: !!u.active,
      allocated: u.quota, used: u.used, trash: u.trash, files: u.files, reserved: pending.get(u.id) || 0,
      remaining: Math.max(0, u.quota - u.used), percent: u.quota ? Math.min(100, u.used / u.quota * 100) : 100 }));
  const allocated = users.reduce((sum, u) => sum + u.allocated, 0);
  const trash = users.reduce((sum, u) => sum + u.trash, 0);
  const warnings = [];
  if (allocated > capacity) warnings.push(`Allocated space (${formatSize(allocated)}) is more than the cloud capacity (${formatSize(capacity)}). Not every member can fill their allowance at once.`);
  if (capacity && (cloud + reserved) / capacity >= 0.9) warnings.push('The cloud is more than 90% full. Free space or raise the capacity.');
  if (disk.total && disk.free / disk.total <= 0.1) warnings.push('The server disk has less than 10% free space.');
  return {
    scannedAt: Date.now(), mode: s.storageMode, configured: !!s.storageConfigured,
    disk, capacity, usable,
    cloud: { used: cloud, trash, live: Math.max(0, cloud - trash), reserved, free: Math.max(0, capacity - cloud - reserved), files: users.reduce((sum, u) => sum + u.files, 0) },
    other: Math.max(0, disk.used - cloud),
    allocated, unallocated: Math.max(0, capacity - allocated), overAllocated: allocated > capacity,
    users, warnings
  };
}
