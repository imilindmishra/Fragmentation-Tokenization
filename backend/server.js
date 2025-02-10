const express = require("express");
const cors = require("cors");
const multer = require("multer");
const admin = require("firebase-admin");
const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");
const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");

// 🔹 Initialize Firebase Admin SDK
const serviceAccount = require("./firebase-admin.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

const app = express();
app.use(cors());
app.use(express.json());

// 🔹 Setup Multer for File Uploads
const upload = multer({
    dest: "uploads/",
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(csv)$/)) {
            return cb(new Error("Only CSV files are allowed!"), false);
        }
        cb(null, true);
    }
});

// 🔹 Pinata API Credentials (Replace with your actual API keys)
const PINATA_API_KEY = "63bd572b9fcf1c207aa1";
const PINATA_SECRET_API_KEY = "1e1beadfcfaaa6d101a587ce92d5a2e3a50a3ec5691fc160abb00ed4fd9e2bf1";

// 🔹 Encrypt Function (AES-256-CBC)
function encryptPII(text) {
    const algorithm = "aes-256-cbc";
    const key = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    return { encrypted, key: key.toString("hex"), iv: iv.toString("hex") };
}

// 🔹 Decrypt Function (AES-256-CBC)
function decryptPII(encrypted, key, iv) {
    const algorithm = "aes-256-cbc";
    const decipher = crypto.createDecipheriv(algorithm, Buffer.from(key, "hex"), Buffer.from(iv, "hex"));
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
}

// 🔹 Upload Second Fragment to IPFS using Pinata
async function uploadToIPFS(data) {
    try {
        const formData = new FormData();
        formData.append("file", Buffer.from(data), "qft_fragment.txt");

        const response = await axios.post("https://api.pinata.cloud/pinning/pinFileToIPFS", formData, {
            headers: {
                "Content-Type": `multipart/form-data; boundary=${formData._boundary}`,
                "pinata_api_key": PINATA_API_KEY,
                "pinata_secret_api_key": PINATA_SECRET_API_KEY
            }
        });

        return response.data.IpfsHash;
    } catch (error) {
        console.error("❌ IPFS Upload Failed:", error.response ? error.response.data : error.message);
        throw new Error("IPFS Upload Failed");
    }
}

// 🔹 Tokenization API (Firebase + IPFS)
app.post("/api/tokenize", upload.single("file"), async (req, res) => {
    try {
        console.log("📂 File Upload Debugging:", req.file);

        if (!req.file || !fs.existsSync(req.file.path)) {
            console.log("❌ File does not exist after upload.");
            return res.status(400).json({ message: "File upload failed" });
        }

        console.log("✅ File received:", req.file.originalname);

        const filePath = req.file.path;
        const formData = new FormData();
        formData.append("file", fs.createReadStream(filePath));

        console.log("📢 Sending file to detect-pii API...");
        const piiResponseRaw = await axios.post("http://127.0.0.1:5001/detect-pii", formData, {
            headers: { ...formData.getHeaders() }
        });

        console.log("✅ PII Detection API Response Received");
        const piiResponse = piiResponseRaw.data;

        if (!piiResponse.pii_values || Object.keys(piiResponse.pii_values).length === 0) {
            console.log("❌ No PII detected in the file.");
            return res.status(400).json({ message: "No PII found in the uploaded file" });
        }

        let tokenizedData = [];
        let batch = db.batch();
        const seenValues = new Set();

        for (const column in piiResponse.pii_values) {
            for (const item of piiResponse.pii_values[column]) {
                if (seenValues.has(item.value)) continue;

                seenValues.add(item.value);

                const token = uuidv4();
                const piiValue = item.value;
                const splitIndex = Math.floor(piiValue.length / 2);
                const fragment1 = piiValue.substring(0, splitIndex);
                const fragment2 = piiValue.substring(splitIndex);

                const encryptedData = encryptPII(fragment1);
                let ipfsHash;
                try {
                    ipfsHash = await uploadToIPFS(fragment2);
                } catch (error) {
                    console.error("❌ IPFS Upload Failed:", error.message);
                    continue;
                }

                const docRef = db.collection("qft_tokens").doc(token);
                batch.set(docRef, {
                    column,
                    piiType: item.type,
                    encryptedValue: encryptedData.encrypted,
                    encryptionKey: encryptedData.key,
                    iv: encryptedData.iv,
                    ipfsHash,
                    createdAt: admin.firestore.Timestamp.now(),
                });

                tokenizedData.push({ column, token });
            }
        }

        await batch.commit();
        res.status(200).json({ message: "✅ QFT Tokenization with IPFS completed", tokenized_data: tokenizedData });

    } catch (error) {
        console.error("❌ Tokenization Failed:", error);
        res.status(500).json({ message: "Tokenization failed", error: error.message });
    }
});

// 🔹 Detokenization API (Retrieve Data from Firestore + IPFS)
app.post("/api/detokenize", async (req, res) => {
    try {
        const { tokens } = req.body;
        if (!tokens || !Array.isArray(tokens)) {
            return res.status(400).json({ message: "Invalid input. Provide an array of tokens." });
        }

        let reconstructedData = [];

        for (const token of tokens) {
            const docRef = db.collection("qft_tokens").doc(token);
            const doc = await docRef.get();

            if (!doc.exists) {
                console.log(`❌ Token ${token} not found in Firestore.`);
                continue;
            }

            const data = doc.data();
            const { encryptedValue, encryptionKey, iv, ipfsHash, column } = data;

            let decryptedFragment1;
            try {
                decryptedFragment1 = decryptPII(encryptedValue, encryptionKey, iv);
            } catch (error) {
                console.error(`❌ Decryption Failed for ${token}:`, error.message);
                continue;
            }

            let fragment2;
            try {
                const ipfsResponse = await axios.get(`https://gateway.pinata.cloud/ipfs/${ipfsHash}`);
                fragment2 = ipfsResponse.data;
            } catch (error) {
                console.error(`❌ IPFS Retrieval Failed for ${ipfsHash}:`, error.message);
                continue;
            }

            const originalPII = decryptedFragment1 + fragment2;

            reconstructedData.push({ column, token, originalValue: originalPII });
        }

        res.status(200).json({ message: "✅ Detokenization Successful", reconstructed_data: reconstructedData });

    } catch (error) {
        console.error("❌ Detokenization Failed:", error);
        res.status(500).json({ message: "Detokenization failed", error: error.message });
    }
});

// 🔹 Start Server
app.listen(5000, () => console.log("🚀 Server running on http://127.0.0.1:5000"));
