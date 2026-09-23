// Rules for the watch-live link and guardian push features.
// Run with the Firestore emulator: firebase emulators:exec --only firestore
//   "npm --prefix functions run test:rules:live"
const { readFileSync } = require('node:fs');
const { strict: assert } = require('node:assert');
const { test, before, after } = require('node:test');
const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, getDoc, deleteField, serverTimestamp } = require('firebase/firestore');

let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-amica-live-share-rules',
    firestore: { rules: readFileSync('../firestore.rules', 'utf8') },
  });
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'journeys', 'j1'), {
      userId: 'alice', status: 'active', metadata: {},
      liveShare: { token: 'tok_aaaaaaaaaaaaaaaaaaaa', url: 'https://x/j/tok' },
    });
    await setDoc(doc(db, 'live_shares', 'tok_aaaaaaaaaaaaaaaaaaaa'), {
      userId: 'alice', journeyId: 'j1', status: 'active',
    });
    await setDoc(doc(db, 'emergency_contacts', 'c1'), {
      userId: 'alice', name: 'Amma', phone: '+94770000001',
      guardianUid: 'bob', guardianName: 'Amma',
    });
    await setDoc(doc(db, 'emergency_contacts', 'c2'), {
      userId: 'alice', name: 'Friend', phone: '+94770000002',
    });
  });
});
after(async () => { await env?.cleanup(); });

test('nobody reads live_shares or guardian_invites directly', async () => {
  const alice = env.authenticatedContext('alice').firestore();
  const anon = env.unauthenticatedContext().firestore();
  await assert.rejects(getDoc(doc(alice, 'live_shares', 'tok_aaaaaaaaaaaaaaaaaaaa')), { code: 'permission-denied' });
  await assert.rejects(getDoc(doc(anon, 'live_shares', 'tok_aaaaaaaaaaaaaaaaaaaa')), { code: 'permission-denied' });
  await assert.rejects(getDoc(doc(alice, 'guardian_invites', 'ABC234')), { code: 'permission-denied' });
});

test('the owner updates her location but cannot rewrite the live link', async () => {
  const alice = env.authenticatedContext('alice').firestore();
  await assert.doesNotReject(updateDoc(doc(alice, 'journeys', 'j1'), {
    currentLocation: { latitude: 6.9, longitude: 79.8 },
  }));
  await assert.rejects(updateDoc(doc(alice, 'journeys', 'j1'), {
    'liveShare.token': 'someone_elses_token_xx',
  }), { code: 'permission-denied' });
});

test('a contact cannot be linked by the client, only unlinked', async () => {
  const alice = env.authenticatedContext('alice').firestore();
  await assert.rejects(updateDoc(doc(alice, 'emergency_contacts', 'c2'), { guardianUid: 'mallory' }), { code: 'permission-denied' });
  await assert.rejects(setDoc(doc(alice, 'emergency_contacts', 'c3'), {
    userId: 'alice', name: 'X', phone: '1', guardianUid: 'mallory',
  }), { code: 'permission-denied' });
  await assert.doesNotReject(updateDoc(doc(alice, 'emergency_contacts', 'c1'), { name: 'Amma K' }));
  await assert.doesNotReject(updateDoc(doc(alice, 'emergency_contacts', 'c1'), {
    guardianUid: deleteField(), guardianName: deleteField(), guardianLinkedAt: deleteField(),
  }));
});

test('device tokens belong to the signed-in user', async () => {
  const bob = env.authenticatedContext('bob').firestore();
  const alice = env.authenticatedContext('alice').firestore();
  const token = { userId: 'bob', platform: 'android', updatedAt: serverTimestamp() };
  await assert.doesNotReject(setDoc(doc(bob, 'fcm_tokens', 't1'), token));
  await assert.rejects(setDoc(doc(bob, 'fcm_tokens', 't2'), { ...token, userId: 'alice' }), { code: 'permission-denied' });
  await assert.rejects(getDoc(doc(alice, 'fcm_tokens', 't1')), { code: 'permission-denied' });
  // Same device, new account.
  await assert.doesNotReject(setDoc(doc(alice, 'fcm_tokens', 't1'), { ...token, userId: 'alice' }));
});
