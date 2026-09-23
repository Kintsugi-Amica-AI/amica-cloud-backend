const { readFileSync } = require('node:fs');
const { strict: assert } = require('node:assert');
const { test, before, after } = require('node:test');
const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');
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
  await assert.doesNotReject(getDoc(ref));
  await assert.doesNotReject(setDoc(ref, review()));
  await assert.rejects(updateDoc(ref, { stars: 1 }), { code: 'permission-denied' });
  await assert.rejects(getDoc(doc(env.authenticatedContext('bob').firestore(), 'vehicle_reviews', 'completed')), { code: 'permission-denied' });
});
test('reject another user, incomplete journey, wrong plate, or invalid stars', async () => {
  const alice = env.authenticatedContext('alice').firestore();
  await assert.rejects(setDoc(doc(env.authenticatedContext('bob').firestore(), 'vehicle_reviews', 'wrong-plate'), review({ userId: 'bob' })), { code: 'permission-denied' });
  await assert.rejects(setDoc(doc(alice, 'vehicle_reviews', 'active'), review()), { code: 'permission-denied' });
  await assert.rejects(setDoc(doc(alice, 'vehicle_reviews', 'wrong-plate'), review({ vehiclePlate: 'CBO3286' })), { code: 'permission-denied' });
  for (const stars of [0, 6, 2.5]) {
    await assert.rejects(setDoc(doc(alice, 'vehicle_reviews', 'bad-stars'), review({ stars })), { code: 'permission-denied' });
  }
});
test('aggregate and journey plate cannot be changed by clients', async () => {
  const db = env.authenticatedContext('alice').firestore();
  await assert.rejects(setDoc(doc(db, 'vehicles', 'CBR6797'), { ratingAverage: 5 }), { code: 'permission-denied' });
  await assert.rejects(updateDoc(doc(db, 'journeys', 'active'), { 'metadata.vehiclePlate': 'CBO3286' }), { code: 'permission-denied' });
});
test('unverified events require the deadline, plate and owner', async () => {
  const db = env.authenticatedContext('alice').firestore();
  const event = { userId: 'alice', vehiclePlate: 'CBR6797', type: 'unanswered_safety_check', createdAt: serverTimestamp() };
  await assert.rejects(setDoc(doc(db, 'vehicle_safety_events', 'future'), event), { code: 'permission-denied' });
  await assert.doesNotReject(setDoc(doc(db, 'vehicle_safety_events', 'completed'), event));
  await assert.rejects(updateDoc(doc(db, 'vehicle_safety_events', 'completed'), { type: 'different' }), { code: 'permission-denied' });
  await assert.rejects(getDoc(doc(env.unauthenticatedContext().firestore(), 'vehicle_safety_events', 'completed')), { code: 'permission-denied' });
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

test('vehicle observations: one per user per plate, known words only', async () => {
  const db = env.authenticatedContext('alice').firestore();
  const observation = (overrides = {}) => ({
    userId: 'alice', vehiclePlate: 'CBR6797', vehicleType: 'car',
    colour: 'white', createdAt: serverTimestamp(), ...overrides,
  });
  const ref = doc(db, 'vehicle_observations', 'CBR6797_alice');
  await assert.doesNotReject(setDoc(ref, observation()));
  await assert.rejects(updateDoc(ref, { colour: 'red' }), { code: 'permission-denied' });
  await assert.rejects(setDoc(ref, observation({ colour: 'red' })), { code: 'permission-denied' });
  // Someone else's id, an unknown word, an extra field, or nothing to say.
  await assert.rejects(setDoc(doc(db, 'vehicle_observations', 'CBR6797_bob'), observation()), { code: 'permission-denied' });
  await assert.rejects(setDoc(doc(db, 'vehicle_observations', 'CBO3286_alice'), observation({ vehiclePlate: 'CBO3286', colour: 'pink' })), { code: 'permission-denied' });
  await assert.rejects(setDoc(doc(db, 'vehicle_observations', 'CBO3286_alice'), observation({ vehiclePlate: 'CBO3286', photo: 'x' })), { code: 'permission-denied' });
  await assert.rejects(setDoc(doc(db, 'vehicle_observations', 'CBO3286_alice'), { userId: 'alice', vehiclePlate: 'CBO3286', createdAt: serverTimestamp() }), { code: 'permission-denied' });
  // Colour alone is fine.
  await assert.doesNotReject(setDoc(doc(db, 'vehicle_observations', 'CBO3286_alice'), { userId: 'alice', vehiclePlate: 'CBO3286', colour: 'blue', createdAt: serverTimestamp() }));
  await assert.rejects(getDoc(doc(env.authenticatedContext('bob').firestore(), 'vehicle_observations', 'CBR6797_alice')), { code: 'permission-denied' });
});
