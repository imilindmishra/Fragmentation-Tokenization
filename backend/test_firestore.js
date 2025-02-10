const admin = require("firebase-admin");
const serviceAccount = require("./firebase-admin.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function testFirestore() {
  try {
    const testDoc = db.collection("test_collection").doc("test_doc");
    await testDoc.set({ message: "Firestore is working!" });

    const doc = await testDoc.get();
    console.log("✅ Firestore test success:", doc.data());
  } catch (error) {
    console.error("❌ Firestore test failed:", error);
  }
}

testFirestore();
