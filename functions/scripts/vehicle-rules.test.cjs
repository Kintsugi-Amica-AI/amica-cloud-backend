const { readFileSync } = require('node:fs');
const { strict: assert } = require('node:assert');
const { test, before, after } = require('node:test');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, getDoc, Timestamp, serverTimestamp } = require('firebase/firestore');
let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-amica-vehicle-rules',
    firestore: { rules: readFileSync('../firestore.rules', 'utf8') },
  });
  await env.withSecurityRulesDisabled(async (context) => {
    for (const id of ['completed', 'active', 'wrong-plate', 'bad-stars', 'future']) {
      await setDoc(doc(context.firestore(), 'journeys', id), {
        userId: 'alice', status: id === 'active' ? 'active' : 'safe',
        metadata: { vehiclePlate: 'CBR6797' },
        estimatedEndTime: Timestamp.fromMillis(id === 'future' ? Date.now() + 600000 : 0),
      });
    }
  });
});
after(async () => { await env?.cleanup(); });
const review = (overrides = {}) => ({
  userId: 'alice', vehiclePlate: 'CBR6797', stars: 4,
  createdAt: serverTimestamp(), ...overrides,
});
test('owner can read missing review, create it once, but not change it', async () => {
  const ref = doc(env.authenticatedContext('alice').firestore(), 'vehicle_reviews', 'completed');
  await assertSucceeds(getDoc(ref));
  await assertSucceeds(setDoc(ref, review()));
  await assertFails(updateDoc(ref, { stars: 1 }));
  await assertFails(getDoc(doc(env.authenticatedContext('bob').firestore(), 'vehicle_reviews', 'completed')));
});
test('reject another user, incomplete journey, wrong plate, or invalid stars', async () => {
  const alice = env.authenticatedContext('alice').firestore();
  await assertFails(setDoc(doc(env.authenticatedContext('bob').firestore(), 'vehicle_reviews', 'wrong-plate'), review({ userId: 'bob' })));
  await assertFails(setDoc(doc(alice, 'vehicle_reviews', 'active'), review()));
  await assertFails(setDoc(doc(alice, 'vehicle_reviews', 'wrong-plate'), review({ vehiclePlate: 'CBO3286' })));
  for (const stars of [0, 6, 2.5]) {
    await assertFails(setDoc(doc(alice, 'vehicle_reviews', 'bad-stars'), review({ stars })));
  }
});
test('aggregate and journey plate cannot be changed by clients', async () => {
  const db = env.authenticatedContext('alice').firestore();
  await assertFails(setDoc(doc(db, 'vehicles', 'CBR6797'), { ratingAverage: 5 }));
  await assertFails(updateDoc(doc(db, 'journeys', 'active'), { 'metadata.vehiclePlate': 'CBO3286' }));
});
test('unverified events require the deadline, plate and owner', async () => {
  const db = env.authenticatedContext('alice').firestore();
  const event = { userId: 'alice', vehiclePlate: 'CBR6797', type: 'unanswered_safety_check', createdAt: serverTimestamp() };
  await assertFails(setDoc(doc(db, 'vehicle_safety_events', 'future'), event));
  await assertSucceeds(setDoc(doc(db, 'vehicle_safety_events', 'completed'), event));
  await assertFails(updateDoc(doc(db, 'vehicle_safety_events', 'completed'), { type: 'different' }));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'vehicle_safety_events', 'completed')));
});

test('duplicate trigger delivery aggregates each journey once', async () => {
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'This test requires the emulator');
  const admin = require('firebase-admin');
  admin.initializeApp({ projectId: 'demo-amica-vehicle-rules' });
  const { aggregateVehicleReview } = require('../lib/triggers/onVehicleReviewCreated');
  const { aggregateVehicleSafetyEvent } = require('../lib/triggers/onVehicleSafetyEventCreated');
  await Promise.all([aggregateVehicleReview('completed'), aggregateVehicleReview('completed')]);
  await Promise.all([aggregateVehicleSafetyEvent('completed'), aggregateVehicleSafetyEvent('completed')]);
  const vehicle = (await admin.firestore().doc('vehicles/CBR6797').get()).data();
  assert.equal(vehicle.ratingTotal, 4);
  assert.equal(vehicle.ratingCount, 1);
  assert.equal(vehicle.ratingAverage, 4);
  assert.equal(vehicle.unverifiedSafetyCheckCount, 1);
  await admin.app().delete();
});
