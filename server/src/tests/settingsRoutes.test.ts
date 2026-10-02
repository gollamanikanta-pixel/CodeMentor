import assert from 'node:assert/strict';
import test from 'node:test';
import { accountSettingsPatchSchema } from '../routes/settingsRoutes.js';

test('account settings accept the client preference keys including AI Deep Help', () => {
  const parsed = accountSettingsPatchSchema.safeParse({
    automaticVisuals: false,
    automaticQuizReadiness: false,
    aiDeepHelp: false,
    theme: 'light',
  });
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.deepEqual(parsed.data, {
      automaticVisuals: false,
      automaticQuizReadiness: false,
      aiDeepHelp: false,
      theme: 'light',
    });
  }
});

test('account settings reject unsupported values instead of accepting provider secrets', () => {
  assert.equal(accountSettingsPatchSchema.safeParse({ aiDeepHelp: 'false' }).success, false);
  const parsed = accountSettingsPatchSchema.safeParse({ aiApiKey: 'not-a-client-setting' });
  assert.equal(parsed.success, true);
  if (parsed.success) assert.deepEqual(parsed.data, {});
});
