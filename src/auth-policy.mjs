export function isGoogleAccount(user) {
  return Boolean(user?.id && user.is_anonymous === false &&
    Array.isArray(user.identities) && user.identities.some(identity => identity.provider === 'google'));
}
export function safeInvite(value) {
  return typeof value==='string' && /^[a-f0-9]{64}$/.test(value) ? value : null;
}
