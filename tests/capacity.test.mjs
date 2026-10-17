import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createApp } from '../src/server.mjs';
import { GiB, MiB, ROOT } from '../src/config.mjs';
import { parseSize, formatSize } from '../src/capacity.mjs';

test('size parsing supports MB, GB and TB and rejects nonsense', () => {
  assert.equal(parseSize('500 GB'), 500 * GiB);
  assert.equal(parseSize('1.5tb'), 1.5 * 1024 * GiB);
  assert.equal(parseSize('2048 mb'), 2048 * MiB);
  assert.equal(parseSize('10 GiB'), 10 * GiB);
  assert.equal(parseSize('20'), 20 * GiB);
  assert.equal(parseSize('20', 'MB'), 20 * MiB);
  for (const bad of ['', 'abc', '-5 GB', '5 PB', '0 GB', '5 XB']) assert.throws(() => parseSize(bad), bad);
  assert.equal(formatSize(1536 * MiB), '1.50 GB');
});

test('administrator disk page, owner capacity modes and pool enforcement', async t => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'shcloudpanel-capacity-'));
  const dataDir = path.join(temp, 'data'), password = '12345678';
  let app;
  try {
    const setup = spawnSync(process.execPath, ['src/cli.mjs', 'setup', '--stdin'], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, DATA_DIR: dataDir },
      input: JSON.stringify({ username: 'boss', email: 'boss@example.com', displayName: 'Boss', password }) });
    assert.equal(setup.status, 0, setup.stderr);
    app = await createApp({ dataDir, port: 0, production: false, secureCookie: false, appUrl: 'http://127.0.0.1' });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${app.server.address().port}`; app.cfg.appUrl = base;
    const request = async (route, { actor, method = 'GET', data, headers = {}, bytes } = {}) => {
      const h = { ...headers }; if (actor) { h.Cookie = actor.cookie; if (method !== 'GET') h['X-CSRF-Token'] = actor.csrf; }
      if (data !== undefined) h['Content-Type'] = 'application/json';
      const response = await fetch(base + route, { method, headers: h, body: bytes ?? (data !== undefined ? JSON.stringify(data) : undefined) });
      return { status: response.status, value: (response.headers.get('content-type') || '').includes('json') ? await response.json() : null, headers: response.headers };
    };
    const login = async identifier => { const r = await request('/api/auth/login', { method: 'POST', data: { identifier, password } }); assert.equal(r.status, 200); return { cookie: r.headers.get('set-cookie').split(';')[0], csrf: r.value.csrf }; };
    const owner = await login('boss');
    const create = async (username, role, quota) => { const r = await request('/api/admin/users', { actor: owner, method: 'POST', data: { username, email: `${username}@example.com`, displayName: username, password, role, quota } }); assert.equal(r.status, 201, JSON.stringify(r.value)); return r.value.user; };
    await create('adam', 'admin', 10 * GiB); await create('mia', 'member', 5 * GiB); await create('max', 'member', 20 * GiB);
    const admin = await login('adam'), mia = await login('mia');

    await t.test('only administrators can open the disk report; members are refused', async () => {
      assert.equal((await request('/api/admin/disk')).status, 401);
      assert.equal((await request('/api/admin/disk', { actor: mia })).status, 403);
      const r = await request('/api/admin/disk', { actor: admin });
      assert.equal(r.status, 200);
      assert.equal(r.value.mode, 'auto');
      assert.ok(r.value.disk.total > 0 && r.value.disk.free >= 0);
      assert.equal(r.value.allocated, (50 + 10 + 5 + 20) * GiB);
      assert.deepEqual(r.value.users.map(u => u.username).sort(), ['adam', 'boss', 'max', 'mia']);
    });

    await t.test('only the owner can change capacity, and sizes are validated against the real disk', async () => {
      assert.equal((await request('/api/admin/storage', { actor: admin, method: 'PATCH', data: { mode: 'auto' } })).status, 403);
      assert.equal((await request('/api/admin/storage', { actor: owner, method: 'PATCH', data: { mode: 'weird' } })).status, 400);
      assert.equal((await request('/api/admin/storage', { actor: owner, method: 'PATCH', data: { mode: 'custom', size: 5, unit: 'PB' } })).status, 400);
      assert.equal((await request('/api/admin/storage', { actor: owner, method: 'PATCH', data: { mode: 'custom', size: 100000, unit: 'TB' } })).status, 400);
    });

    await t.test('a custom MB capacity is enforced across all accounts and Auto removes it', async () => {
      const set = await request('/api/admin/storage', { actor: owner, method: 'PATCH', data: { mode: 'custom', size: 3, unit: 'MB' } });
      assert.equal(set.status, 200, JSON.stringify(set.value));
      assert.equal(set.value.mode, 'custom'); assert.equal(set.value.capacity, 3 * MiB); assert.equal(set.value.overAllocated, true);
      const upload = (actor, name, size) => request('/api/upload', { actor, method: 'POST', bytes: Buffer.alloc(size, 7), headers: { 'X-File-Name': encodeURIComponent(name) } });
      assert.equal((await upload(mia, 'a.bin', 2 * MiB)).status, 201);
      const full = await upload(admin, 'b.bin', 2 * MiB);
      assert.equal(full.status, 413, JSON.stringify(full.value));
      assert.equal((await upload(admin, 'c.bin', MiB)).status, 201);
      const report = (await request('/api/admin/disk', { actor: admin })).value;
      assert.equal(report.cloud.used, 3 * MiB); assert.equal(report.cloud.free, 0);
      assert.equal(report.users.find(u => u.username === 'mia').used, 2 * MiB);
      assert.equal((await request('/api/admin/storage', { actor: owner, method: 'PATCH', data: { mode: 'custom', size: 1, unit: 'MB' } })).status, 400);
      const auto = await request('/api/admin/storage', { actor: owner, method: 'PATCH', data: { mode: 'auto' } });
      assert.equal(auto.status, 200); assert.equal(auto.value.mode, 'auto');
      assert.equal((await upload(admin, 'd.bin', 2 * MiB)).status, 201);
    });
  } finally {
    if (app) await app.close?.();
    await rm(temp, { recursive: true, force: true });
  }
});
