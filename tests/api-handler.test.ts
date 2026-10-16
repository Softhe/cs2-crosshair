import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { IncomingMessage, ServerResponse } from 'node:http';
import handler, { deploymentOrigin } from '../api/[...path].ts';

test('deployment origin accepts configured and Vercel preview origins', () => {
  assert.equal(deploymentOrigin({ PUBLIC_ORIGIN: 'https://example.com' } as NodeJS.ProcessEnv), 'https://example.com');
  assert.equal(
    deploymentOrigin({ VERCEL_URL: 'studio-abc123.vercel.app' } as NodeJS.ProcessEnv),
    'https://studio-abc123.vercel.app',
  );
  assert.throws(() => deploymentOrigin({} as NodeJS.ProcessEnv), /PUBLIC_ORIGIN or VERCEL_URL/);
  assert.throws(() => deploymentOrigin({ PUBLIC_ORIGIN: 'https://example.com/' } as NodeJS.ProcessEnv));
  assert.throws(() => deploymentOrigin({ VERCEL_URL: 'attacker.invalid' } as NodeJS.ProcessEnv));
});

test('deployed handler returns 503 when the account service is unavailable', async () => {
  const saved = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const originalError = console.error;
  console.error = () => {};
  try {
    let status = 0;
    let body = '';
    const req = { url: '/api/session', method: 'GET', headers: {} };
    const res = {
      headersSent: false,
      writeHead: (code: number) => { status = code; },
      end: (chunk?: unknown) => { body = String(chunk ?? ''); },
    };
    await handler(req as unknown as IncomingMessage, res as unknown as ServerResponse);
    assert.equal(status, 503);
    assert.deepEqual(JSON.parse(body), { error: 'The account service is temporarily unavailable.' });
  } finally {
    console.error = originalError;
    if (saved !== undefined) process.env.DATABASE_URL = saved;
  }
});
