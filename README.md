# ⚖️ Legal Metrology Compliance Checker

An automated, AI-powered compliance checking system developed under the **Legal Metrology Act, 2009** and the **Legal Metrology (Packaged Commodities) Rules, 2011**. 

This system automatically detects, extracts, and validates mandatory declarations on packaged commodity labels, product listings, and packaging images to identify violations and streamline inspections for enforcement agencies in India.

---

## ✨ Features

### 🔍 Automated Packaging Scanning
- **High-Accuracy OCR**: Scans packaging labels and extracts raw text using Google Cloud Vision API.
- **Dynamic Input**: Supports camera capture (direct photo of packaging), file uploads, and manual text override.
- **Barcode Lookup**: Extracts product barcodes and queries Open Food Facts / UPC registries.

### ⚖️ Rules Engine (LM Packaged Commodities Rules, 2011)
Validates all 10 mandatory declarations required on packaged goods:
1. **Generic/Common Product Name**
2. **Net Quantity** (in standard weight, volume, or count format)
3. **Date of Manufacture/Packing/Import** (Month & Year)
4. **Maximum Retail Price (MRP)** (inclusive of all taxes)
5. **Manufacturer/Packer/Importer Details** (complete name and physical address)
6. **Consumer Care Details** (helpline number and contact email)
7. **Best Before/Expiry Date** (for perishables)
8. **Country of Origin** (mandatory declaration for imported goods)
9. **FSSAI License Number** (validated for food items)
10. **Retail Sale Unit Price** (price representation check)

### 📊 Enforcement Dashboard & Repository
- **Digital Audit Trail**: Keeps a persistent log of all scanned products, compliance scores, and violations in MongoDB Atlas.
- **Analytics Overview**: Visualizes total inspections, compliant vs. non-compliant percentages, and average scores.
- **Search & Retrieve**: Easily find previous inspections by product name, date, or barcode.
- **PDF Report Generation**: Exports clean, formatted, print-ready inspection reports and violation summaries.

---

## 🛠️ Tech Stack

| Category | Technologies |
|----------|-------------|
| **Frontend** | React 18, TypeScript, Tailwind CSS, Vite |
| **Backend** | Vercel Serverless Functions (Node.js) |
| **Database** | MongoDB Atlas |
| **Authentication** | JWT, bcryptjs |
| **OCR & APIs** | Google Cloud Vision API, Open Food Facts, UPCitemdb |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- MongoDB Atlas cluster
- Google Cloud Vision API Key / Service Account credentials (optional; fallback to browser scanner and manual text mode works out of the box)

### Installation & Run

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up your environment variables**
   Create a `.env` file in the root directory (or edit the template):
   ```env
   # MongoDB Connection (Required)
   MONGODB_URI=mongodb+srv://your_user:your_password@cluster.mongodb.net/smartbite
   
   # JWT Secret for Auth (Required)
   JWT_SECRET=your-jwt-secret-key
   
   # Google Cloud Vision (Optional - for OCR text extraction)
   VITE_GOOGLE_CLOUD_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
   VITE_GOOGLE_CLOUD_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----"
   ```

3. **Run the development server**
   ```bash
   npm run dev
   ```

4. **Open in browser**
   Visit `http://localhost:5173` to test the application.

---

## 📁 Project Structure

```
├── api/                  # Vercel Serverless Functions (Backend)
│   ├── auth/             # Login, Registration, and Google Auth
│   ├── products/         # Scan saving, retrieval, and deletion API
│   ├── lib/              # JWT verification and MongoDB connections
│   └── health.js         # API server health check
├── src/                  # Frontend (React App)
│   ├── components/       # Layout, settings panel, camera capture modals
│   ├── context/          # Auth context and Products/Scans state context
│   ├── pages/            # Dashboard, Scan Product, Repository, and detailed Report pages
│   ├── services/         # API fetching, regex compliance checking, and OCR service
│   ├── types.ts          # TypeScript type definitions for compliance records
│   └── main.tsx          # React application entry point
├── vite.config.ts        # Vite configuration & local development API proxy server
└── .env                  # Configuration keys (locally stored only)
```

---

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
