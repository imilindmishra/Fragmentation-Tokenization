const express = require("express");
const cors = require("cors");
const multer = require("multer");
const admin = require("firebase-admin");
const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");
const fs = require("fs");
const FormData = require("form-data");

// Initialize Firebase Admin SDK
const serviceAccount = require("./firebase-admin.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://<your-project-id>.firebaseio.com",
});
const db = admin.firestore();

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });

// Encrypt function
function encryptPII(text) {
  const algorithm = "aes-256-cbc";
  const key = crypto.randomBytes(32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return { encrypted, key: key.toString("hex"), iv: iv.toString("hex") };
}

// Tokenization API
app.post("/api/tokenize", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    // Send CSV to PII detection microservice
    const filePath = req.file.path;
    const formData = new FormData();
    formData.append("file", fs.createReadStream(filePath));
    const piiResponseRaw = await fetch("http://127.0.0.1:5001/detect-pii", {
      method: "POST",
      body: formData,
    });
    const piiResponseText = await piiResponseRaw.text(); // Get raw response
    console.log("PII Detection Raw Response:", piiResponseText); // Debug log

    const piiResponse = JSON.parse(piiResponseText); // Convert to JSON

    let tokenizedData = [];
    let batch = db.batch(); // Batch Firestore writes for performance

    for (const column in piiResponse.pii_values) {
      for (const item of piiResponse.pii_values[column]) {
        const token = uuidv4();
        const encryptedData = encryptPII(item.value);

        // Store in Firebase
        const docRef = db.collection("qft_tokens").doc(token);
        batch.set(docRef, {
          column,
          piiType: item.type,
          encryptedValue: encryptedData.encrypted,
          encryptionKey: encryptedData.key,
          iv: encryptedData.iv,
          createdAt: admin.firestore.Timestamp.now(),
        });

        // Replace actual PII with token
        tokenizedData.push({ column, token });
      }
    }

    await batch.commit(); // Commit all Firebase writes at once

    res.status(200).json({
      message: "QFT Tokenization completed",
      tokenized_data: tokenizedData,
    });
  } catch (error) {
    console.error("Tokenization Failed:", error);
    res
      .status(500)
      .json({ message: "Tokenization failed", error: error.message });
  }
});

// Detokenization API
app.post("/api/detokenize", async (req, res) => {
  try {
    const { token } = req.body;
    const doc = await db.collection("qft_tokens").doc(token).get();

    if (!doc.exists)
      return res.status(404).json({ message: "Token not found" });

    const record = doc.data();

    // Decrypt the PII value
    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      Buffer.from(record.encryptionKey, "hex"),
      Buffer.from(record.iv, "hex")
    );
    let decrypted = decipher.update(record.encryptedValue, "hex", "utf8");
    decrypted += decipher.final("utf8");

    res.status(200).json({ original_value: decrypted });
  } catch (error) {
    console.error("Detokenization Failed:", error);
    res.status(500).json({ message: "Detokenization failed" });
  }
});

app.listen(5000, () =>
  console.log("🚀 QFT Tokenization Server running on http://localhost:5000")
);
