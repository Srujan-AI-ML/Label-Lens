# ⚖️ Legal Metrology Compliance Checker

> **An AI-powered, automated compliance checking system for packaged commodities under the Legal Metrology (Packaged Commodities) Rules, 2011.**

Packaged commodities sold across retail stores, supermarkets, and e-commerce platforms in India must bear mandatory declarations in prescribed formats. This application gives enforcement officials and consumers an instant, automated mechanism to scan packaging, extract text via OCR, detect barcodes, and validate all 10 mandatory declarations — identifying non-compliances and violations in seconds.

---

## 🏅 Tech Stack — At a Glance

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Google Cloud](https://img.shields.io/badge/Google%20Cloud-4285F4?style=for-the-badge&logo=googlecloud&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)

---

## 🛠️ Technology Stack & Languages by Task

| 🔧 Task / Component | 💻 Languages & Frameworks | 📦 Libraries & Tools | 📝 Description |
| :--- | :--- | :--- | :--- |
| **Frontend UI & Views** | TypeScript, TSX, HTML5, CSS3 | React 18, Tailwind CSS, Lucide Icons | Responsive inspection dashboard, grid form editor, live rules checklists, and dark mode interface |
| **State & Local Cache** | TypeScript | React Context API, Web LocalStorage API | Optimistic UI updates, instant (0ms) dashboard loading, and background database syncing |
| **Backend & REST APIs** | JavaScript (ES Modules), Node.js | Vercel Serverless Functions | Serverless endpoints for inspection persistence (`/api/products`), single product queries (`/api/products/:id`), and authentication |
| **Database & Persistence** | NoSQL, MongoDB Query Language | MongoDB Atlas, `mongodb` Node SDK | Cloud-hosted NoSQL document database storing inspection logs, compliance scores, and evidence photos |
| **Authentication & Security** | JavaScript, Node.js | JWT (`jsonwebtoken`, `jose`), `bcryptjs` | Role-based user authentication, password salting/hashing, and PKCS8 service account key parsing |
| **Vision OCR & Barcode** | TypeScript, JavaScript, REST | Google Cloud Vision API, `BarcodeDetector` API, HTML5 Canvas | High-precision label OCR extraction, native browser barcode scanning, and image preprocessing |
| **Product Registry Lookup** | JavaScript, HTTP / REST | Open Food Facts API, UPCitemdb API | Barcode-to-product mapping to verify product names and brand identities |
| **Report Generation & PDF** | CSS3 (`@media print`), JavaScript | Window Print Engine, CSS Paged Media | Official digital compliance inspection certificates with print-to-PDF export |
| **Build & Dev Tooling** | TypeScript, Node.js | Vite 5, PostCSS, Autoprefixer | Fast HMR dev server and optimized production bundling |

---

## ✨ Key Features

### 1. 🔍 Multi-Modal Packaging Input
- **📷 Camera Scan**: Real-time camera viewfinder with alignment guide and OCR extraction.
- **📤 Image Upload**: Drag-and-drop or file upload for high-resolution packaging photos and evidence.
- **✍️ Specifics Grid Form**: Interactive, emoji/icon-rich grid to manually fill or edit declaration specifics (Net Weight, MRP, Mfg Date, Expiry, Manufacturer, FSSAI, Consumer Care, Origin, USP).

### 2. ⚖️ Rule-Based Compliance Engine (Rules, 2011)
Validates all **10 mandatory declarations** required under the Legal Metrology (Packaged Commodities) Rules, 2011:

| # | Declaration | Regulation |
|---|---|---|
| 1 | 🏷️ **Generic / Common Product Name** | Rule 6(1) |
| 2 | ⚖️ **Net Quantity** (g, kg, ml, L, pcs) | Rule 6(2) |
| 3 | 💰 **Maximum Retail Price (MRP)** (incl. all taxes) | Rule 6(3) |
| 4 | 📅 **Date of Manufacture / Packing / Import** | Rule 6(4) |
| 5 | ⌛ **Best Before / Expiry Date** (for perishables) | Rule 6(5) |
| 6 | 🏭 **Manufacturer / Packer / Importer Name & Full Address** | Rule 6(6) |
| 7 | 📞 **Consumer Care Details** (helpline + contact email) | Rule 6(7) |
| 8 | 🛡️ **FSSAI 14-Digit License Number** | FSSAI Act |
| 9 | 🌐 **Country of Origin** (mandatory for imported goods) | Rule 6(10) |
| 10 | 💵 **Retail Sale Unit Price (USP)** (per-gram/ml) | Rule 6(3A) |

### 3. 📊 Enforcement Dashboard & Side-Box Checklist
- **Real-Time Side Box**: Selecting any scanned product displays a dedicated side box featuring the **Rules 2011 Checklist** with **Green Ticks (✔️ Pass)** for compliant fields and **Red Crosses (❌ Fail)** for violations.
- **Aggregate Analytics**: Total inspections, fully compliant count, violation summary, and average compliance score.
- **Persistent Products Registry**: Filterable and searchable product database with status filters (`Compliant`, `Partially Compliant`, `Non-Compliant`).
- **Official PDF Reports**: Instant one-click print/export for digital inspection certificates with inspector field notes.

---

## 📁 Project Architecture

```
├── api/                       # Backend Serverless Functions (Node.js)
│   ├── auth/                  # Register, Login & Google OAuth
│   │   ├── register.js
│   │   ├── login.js
│   │   └── google.js
│   ├── products/              # Products & Inspections CRUD API
│   │   ├── index.js           # GET all scans, POST new scan
│   │   └── [id].js            # GET, PUT (notes), DELETE scan record
│   ├── lib/                   # Shared DB & Security Helpers
│   │   ├── mongodb.js         # MongoDB Atlas client connection pooling
│   │   └── auth.js            # JWT verification middleware
│   └── health.js              # Server health check endpoint
├── src/                       # Frontend Application (React + TypeScript)
│   ├── components/            # Reusable UI Components
│   │   ├── AddProductModal.tsx # Interactive Add / Scan modal popup with specifics grid
│   │   ├── CameraModal.tsx    # Live camera scanner with OCR alignment guide
│   │   ├── Layout.tsx         # App shell, navigation header with Scanner icon
│   │   └── SettingsPanel.tsx  # Theme and system preferences
│   ├── context/               # Global State Management
│   │   ├── AuthContext.tsx    # Authentication state & tokens
│   │   ├── ProductContext.tsx # Instant-load product cache & API sync
│   │   └── ThemeContext.tsx   # Light/Dark mode state
│   ├── pages/                 # Main Application Views
│   │   ├── Dashboard.tsx      # Overview stats, recent items, side-box checklist
│   │   ├── ScanProduct.tsx    # Dedicated scan & specifics grid workspace
│   │   ├── Repository.tsx     # Products & inspections database registry
│   │   ├── ReportDetail.tsx   # Official inspection certificate & PDF export
│   │   └── LoginPage.tsx      # Sign in & Registration
│   ├── services/              # Business Logic & External Integrations
│   │   ├── complianceService.ts # Legal Metrology Rules, 2011 validation engine
│   │   ├── visionService.ts   # Google Cloud Vision OCR & Barcode detection
│   │   └── api.ts             # Type-safe frontend API client
│   ├── types.ts               # Core TypeScript interfaces & declarations
│   └── main.tsx               # App entry point
├── vite.config.ts             # Vite dev server with integrated API middleware
└── README.md                  # Technical documentation (this file)
```

---

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/Srujan-AI-ML/Smart-Bite.git
cd Smart-Bite
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
Create a `.env` file in the root directory (copy from `.env.example`):
```env
# MongoDB Atlas Database URI (Required)
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/smartbite

# JWT Secret Key (Required)
JWT_SECRET=your-secure-jwt-secret

# Google Cloud Vision Credentials (Optional - for advanced OCR)
VITE_GOOGLE_CLOUD_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
VITE_GOOGLE_CLOUD_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY\n-----END PRIVATE KEY-----"
```

> ⚠️ **NEVER commit your `.env` file!** It is already listed in `.gitignore`.

### 4. Run the development server
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 🛡️ Security Notes

- All secrets and credentials are loaded **exclusively via environment variables** (`.env` or Vercel project settings)
- `.env` is listed in `.gitignore` and is **never committed to version control**
- JWT tokens are signed using PKCS8; passwords are hashed using `bcryptjs`
- Each user's inspection data is fully isolated by authenticated user ID

---

## 👤 Author

| Field | Details |
|---|---|
| **Name** | Srujan |
| **GitHub** | [Srujan-AI-ML](https://github.com/Srujan-AI-ML) |
| **Repository** | [Smart-Bite](https://github.com/Srujan-AI-ML/Smart-Bite) |
| **Email** | *(to be updated)* |

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.



