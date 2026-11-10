import assert from 'node:assert/strict';
import {oauthErrorCode} from '../src/auth-return.mjs';
assert.equal(oauthErrorCode('https://example.test/?error_code=identity_already_exists'),'identity_already_exists');
assert.equal(oauthErrorCode('https://example.test/#error=server_error&error_code=identity_already_exists'),'identity_already_exists');
assert.equal(oauthErrorCode('https://example.test/#error=access_denied'),'oauth_cancelled');
assert.equal(oauthErrorCode('https://example.test/?code=123'),null);
console.log('OAuth callback: query and fragment errors, identity conflict, and cancellation passed.');
