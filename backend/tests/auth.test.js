import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(currentDir, '.tmp', 'center.sqlite');
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'markaz123';
process.env.NODE_ENV = 'test';
process.env.DB_PATH = './backend/tests/.tmp/center.sqlite';

fs.rmSync(dbPath, { force: true });
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const { default: app } = await import('../app.js');
const { db } = await import('../config/database.js');

let server;
let port;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  port = server.address().port;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  db.close();
  fs.rmSync(dbPath, { force: true });
});

describe('backend auth and health', () => {
  test('health endpoint reports app and database status', async () => {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`);
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.database, 'ok');
  });

  test('admin login succeeds and invalid login fails', async () => {
    const success = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'markaz123' }),
    });
    const successPayload = await success.json();
    assert.equal(success.status, 200);
    assert.equal(successPayload.user.role, 'admin');
    assert.ok(successPayload.token);

    const failure = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrong-password' }),
    });
    assert.equal(failure.status, 401);
  });

  test('teacher login succeeds and access checks respect teacher group ownership', async () => {
    const teacherLogin = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'ahmed', password: 'teacher123' }),
    });
    const teacherPayload = await teacherLogin.json();
    assert.equal(teacherLogin.status, 200);
    assert.equal(teacherPayload.user.role, 'teacher');

    const meResponse = await fetch(`http://127.0.0.1:${port}/api/auth/me`, {
      headers: { Authorization: `Bearer ${teacherPayload.token}` },
    });
    const mePayload = await meResponse.json();
    assert.equal(meResponse.status, 200);
    assert.equal(mePayload.role, 'teacher');

    const groupsResponse = await fetch(`http://127.0.0.1:${port}/api/groups`, {
      headers: { Authorization: `Bearer ${teacherPayload.token}` },
    });
    const groups = await groupsResponse.json();
    assert.equal(groupsResponse.status, 200);
    assert.ok(groups.length > 0);
    const group = groups[0];
    assert.equal(group.teacherId, mePayload.teacherId);

    const unauthorizedGroup = await fetch(`http://127.0.0.1:${port}/api/groups/${groups[0].id + 999}`, {
      headers: { Authorization: `Bearer ${teacherPayload.token}` },
    });
    assert.equal(unauthorizedGroup.status, 404);
  });
});
