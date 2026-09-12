// Uses Application Default Credentials; never put credentials in this file.
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const records = require('../../seed-data/scan_vehicle_demo.json');
if (process.env.GOOGLE_CLOUD_PROJECT !== 'amica-cloud-backend') {
  throw new Error('Set GOOGLE_CLOUD_PROJECT=amica-cloud-backend (development only).');
}
initializeApp({ credential: applicationDefault(), projectId: process.env.GOOGLE_CLOUD_PROJECT });
async function seed() {
  for (const record of records) {
    const ref = getFirestore().collection('vehicles').doc(record.normalizedPlateNumber);
    if (process.argv.includes('--verify')) {
      const data = (await ref.get()).data();
      if (!data) throw new Error(`Missing ${record.normalizedPlateNumber}`);
      console.log(JSON.stringify({ plate: record.normalizedPlateNumber,
        ratingAverage: data.ratingAverage, ratingCount: data.ratingCount, demo: data.metadata?.demo === true }));
      continue;
    }
    await getFirestore().runTransaction(async (tx) => {
      if ((await tx.get(ref)).exists) return; // Preserve real data and existing ratings.
      tx.create(ref, { ...record, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    });
    console.log(`Checked ${record.normalizedPlateNumber}`);
  }
}
seed().catch((error) => { console.error(error.message); process.exitCode = 1; });
