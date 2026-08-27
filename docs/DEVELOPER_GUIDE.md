# Label Lens - Technical Developer Guide

**Author:** Srujan  
**Contact:** asgaladechronicles@gmail.com  
**Version:** 1.1.0

This document provides a comprehensive technical overview of **Label Lens**, designed for developers, maintainers, and hackathon technical evaluators.

---

## 🛠️ Tech Stack & Architecture

Label Lens is built on a modern full-stack architecture featuring a **Serverless Backend** and a **Fast Single Page Frontend (SPA)**.

```mermaid
graph TD
    A[Client UI - React + Vite] -->|HTTPS Requests| B[Serverless Endpoints - Vercel Node.js]
    B -->|Mongoose / Native Driver| C[(MongoDB Atlas Database)]
    A -->|Direct API Call| D[Google Cloud Vision OCR]
    A -->|Barcode Detection API| E[Local Browser SDK / Fallback]
```

### 1. Frontend: React & Vite
*   **Vite** was selected over standard Create React App (CRA) or Next.js frontend rendering due to:
    *   **Lightning-Fast Development:** Leverages native ES modules for instant hot module replacement (HMR).
    *   **Optimized Production Build:** Uses Rollup to generate highly tree-shaken and split static assets, decreasing load time to under 1 second.
    *   **Configurability:** Seamless integration with TypeScript and CSS-in-JS configurations.
*   **Styling:** Custom styling built on Vanilla CSS utilities to ensure full responsive control and zero external footprint.
*   **Icons:** Lucide React for consistent visual metaphors.

### 2. Backend: Serverless Functions (Vercel Node.js API)
*   Located in the `/api` directory.
*   Runs on Vercel's Edge/Serverless infrastructure, meaning zero maintenance, instant horizontal scaling, and zero hosting costs when inactive.
*   Uses **Express-like micro-routes** mapping directly to database handlers.

### 3. Database: MongoDB Atlas (Mongoose ODM / Native Driver)
*   **MongoDB** was chosen for its schema flexibility, allowing scans with variable numbers of declarations and violations to be saved dynamically without strict migrations.
*   **Schemas:**
    *   `UserSchema`: Storing email, password (hashed via `bcryptjs`), and optional Google OAuth identifier profiles.
    *   `ProductSchema`: Capturing name, barcode, mfg/expiry dates, FSSAI license, compliance score, status classification, detailed violations log, and scanning metadata.

---

## 🧠 Deep-Dive Technical Implementations

### 1. Serverless Database Connection Caching (Pooling)
*   **Source File:** [`api/lib/mongodb.js`](file:///c:/Users/asgal/Downloads/Smart-Bite-main/Smart-Bite-main/api/lib/mongodb.js)
*   **Challenge:** Serverless functions are stateless and spin up/down rapidly. Initiating a new database connection pool on every request quickly exhausts MongoDB Atlas connection limits and adds a 1–2s connection latency penalty to every API call.
*   **Solution:** The database helper caches the `MongoClient` and connection instance in a global scope (`cachedClient` and `cachedDb`). Subsequent hot-start invocations reuse the cached connection pool instantly (0ms setup time).
*   **Fail-Safe:** Added `connectTimeoutMS: 5000` and `serverSelectionTimeoutMS: 5000` configurations. If the database firewall (IP Whitelist) blocks the serverless function, it fails fast in 5 seconds and returns a clean HTTP 500 error instead of hanging and causing a Vercel 504 gateway timeout.

### 2. Google OAuth & JWT Verification Mechanics
*   **Source Files:** [`api/auth/google.js`](file:///c:/Users/asgal/Downloads/Smart-Bite-main/Smart-Bite-main/api/auth/google.js) & [`src/context/AuthContext.tsx`](file:///c:/Users/asgal/Downloads/Smart-Bite-main/Smart-Bite-main/src/context/AuthContext.tsx)
*   **Flow:**
    1. Client-side Google Identity Services SDK requests authorization and returns a Base64 ID Token (`credential`) to `LoginPage.tsx`.
    2. The token is sent to the Vercel API endpoint `/api/auth/google`.
    3. The backend uses `google-auth-library` (`OAuth2Client.verifyIdToken`) to cryptographically verify the signature using Google's public keys.
    4. Upon successful validation, the backend matches the Google ID payload (`sub`) against the database. If it's a new account, it creates a sanitized unique username (appending incremental suffixes like `_1`, `_2` if the name is already taken to avoid duplicate index database exceptions).
    5. The server signs a JSON Web Token (JWT) using a secure `JWT_SECRET` key and passes it back to the client. The client stores it locally in the browser (`labellens-token`).

### 3. Dynamic Date Normalization (`formatToISODate`)
*   **Source Files:** [`src/pages/ScanProduct.tsx`](file:///c:/Users/asgal/Downloads/Smart-Bite-main/Smart-Bite-main/src/pages/ScanProduct.tsx) & [`src/components/AddProductModal.tsx`](file:///c:/Users/asgal/Downloads/Smart-Bite-main/Smart-Bite-main/src/components/AddProductModal.tsx)
*   **Challenge:** OCR scans pull dates in unstructured text strings containing dot separators, forward slashes, or 2-digit years (e.g. `20.10.15` or `08/26`). Browsers require strict ISO standard `YYYY-MM-DD` inputs to populate calendar datepickers.
*   **Solution:** A custom string normalization pipeline evaluates the text through regular expressions:
    *   *3-part Dates:* `DD.MM.YY(YY)` -> Normalizes short years by appending `20` prefix to the 2-digit year (e.g. `15` becomes `2015`) and returns `YYYY-MM-DD`.
    *   *2-part Dates:* `MM/YY(YY)` -> Extracts month and year, defaults day to `01`, converts 2-digit years, and outputs `YYYY-MM-01`.

---

## 🧠 Core Algorithmic Systems

### 1. OCR Parser & Capturing Engine
*   **Service File:** [`src/services/complianceService.ts`](file:///c:/Users/asgal/Downloads/Smart-Bite-main/Smart-Bite-main/src/services/complianceService.ts)
*   Runs OCR text blocks through a pattern-matching state machine to extract the 10 mandatory declarations under Legal Metrology Rules.
*   Uses regex capture groups rather than raw strings to discard prefixes (e.g. parsing `MRP: Rs. 250.00` down to `250.00`).
*   Configured with spelling-fault-tolerant regex patterns to capture text even with typical OCR reading mistakes (e.g., matching "best before" when read as "best bfore", "best befor", or "best bfor").

### 2. Legal Metrology Rule 13 Font Analyzer
*   Evaluates font height compliance dynamically matching India's **Legal Metrology (Packaged Commodities) Rules, 2011 (Rule 13)**.
*   **Algorithm Flow:**
    1. Parse the weight/volume value inside `netQuantity` and normalize it to grams (e.g. Converting metric/imperial sizes such as `16 oz` or `1 kg`).
    2. Determine the legal minimum letter height requirement:
        *   $\le$ 50g: **1.0 mm**
        *   50g – 200g: **1.5 mm**
        *   200g – 1kg: **2.0 mm**
        *   $>$ 1kg: **4.0 mm**
    3. Evaluate OCR confidence scores on all parsed tokens. If the confidence of any verified token is `low` (indicating printing size is too small, blurry, or low-contrast), the system generates a **Readability / Font Size Check** violation displaying the required minimum legal height in millimeters.

### 3. Dual-Layer Barcode Engine
*   **Service File:** [`src/services/visionService.ts`](file:///c:/Users/asgal/Downloads/Smart-Bite-main/Smart-Bite-main/src/services/visionService.ts)
*   **Primary Layer:** Native browser `BarcodeDetector` processing canvas frame buffers locally.
*   **Secondary Layer:** Server-side fallback that extracts barcode digits directly from raw text layouts using regex patterns if camera drivers fail.

---

## 🚀 Local Setup & Build Commands

1.  **Install dependencies:**
    ```bash
    npm install
    ```
2.  **Run development server:**
    ```bash
    npm run dev
    ```
3.  **Compile verification build:**
    ```bash
    npx tsc --noEmit
    ```
4.  **Production build compilation:**
    ```bash
    npm run build
    ```
