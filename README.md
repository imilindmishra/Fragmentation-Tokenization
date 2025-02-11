# Quantum Fragmentation Tokenization (QFT) for Secure PII

A secure, scalable solution for PII protection that leverages AI-driven detection, advanced data masking, and Quantum Fragmentation Tokenization (QFT). Our system processes multiple CSV files, extracts PII using Microsoft Presidio AI, masks data with AES + FPE, fragments the data into two parts, and securely stores them on Firebase and IPFS.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Setup and Installation](#setup-and-installation)
  - [Backend (Node.js/Express)](#backend-nodejsexpress)
  - [PII Detection Service (Flask)](#pii-detection-service-flask)
- [Usage](#usage)
- [Comparison: Masking + QFT vs Traditional Tokenization](#comparison-masking--qft-vs-traditional-tokenization)
- [License](#license)

---

## Overview

This project provides a robust solution for protecting Personally Identifiable Information (PII) by:

1. **Uploading Multiple CSV Files:** Users can upload several CSV files at once.
2. **AI-Driven PII Extraction:** Using Microsoft Presidio AI, PII is automatically detected from the CSV data.
3. **Advanced Tokenization:** 
   - **Data Masking:** Applies AES + Format-Preserving Encryption (FPE) to mask sensitive data.
   - **Quantum Fragmentation Tokenization (QFT):** Splits masked data into fragments.
   - **Token Generation:** Generates a unique UUID to link the fragments.
4. **Dual Storage:** One fragment is securely stored in Firebase, and the other is stored on IPFS (via Pinata) for decentralized, immutable storage.
5. **Reconstruction:** Only authorized users can reassemble the original data by retrieving both fragments.

---

## Features

- **Multi-CSV File Upload:** Efficiently processes multiple CSV files concurrently.
- **AI-Powered PII Detection:** Integrates with Microsoft Presidio AI to extract PII from data.
- **Hybrid Encryption & Tokenization:** Combines AES + FPE masking with QFT.
- **Dual Storage Approach:** Uses Firebase for secure storage and IPFS for decentralized backup.
- **Parallel Processing:** Optimized performance with concurrent processing for both tokenization and detokenization workflows.

---

## Architecture

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Front-End
    participant BE as Server (Node.js/Express)
    participant PII as PII Service (Flask)
    participant AI as Microsoft Presidio AI
    participant FB as Firebase
    participant IPFS as IPFS (Pinata)

    U->>FE: Upload multiple CSV files
    FE->>BE: POST /api/tokenize (files)
    activate BE
    loop For each CSV file
        BE->>PII: POST /detect-pii (CSV file)
        activate PII
            PII->>AI: Analyze CSV content for PII
            AI-->>PII: Return detected PII data
        deactivate AI
        PII-->>BE: Return PII values

        BE->>BE: Mask PII with AES + FPE
        BE->>BE: Fragment data (QFT) & generate UUID token
        BE->>IPFS: Upload fragment2 (decentralized storage)
        BE->>FB: Store fragment1 (secure storage)
    end
    BE-->>FE: Return tokenized tokens
    FE-->>U: Display tokenized tokens
    deactivate BE

    U->>FE: Request detokenization with tokens
    FE->>BE: POST /api/detokenize (tokens)
    activate BE
        BE->>FB: Retrieve fragment1
        BE->>IPFS: Retrieve fragment2
        BE->>BE: Reconstruct original PII
    BE-->>FE: Return original PII
    FE-->>U: Display original PII
    deactivate BE
