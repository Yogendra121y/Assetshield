const admin = require('firebase-admin')

if (!admin.apps.length) {
  const credential = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    ? admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))
    : admin.credential.applicationDefault()

  admin.initializeApp({
    credential,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  })
}

const db     = admin.firestore()
const auth   = admin.auth()
const bucket = admin.storage().bucket()

module.exports = { admin, db, auth, bucket }
