# ⚖️ Label Lens — Legal Metrology Compliance Checker

> **An AI-powered, automated compliance checking system for packaged commodities under the Legal Metrology (Packaged Commodities) Rules, 2011.**

Packaged commodities sold across retail stores, supermarkets, and e-commerce platforms in India must bear mandatory declarations in prescribed formats. This application gives enforcement officials and consumers an instant, automated mechanism to scan packaging, analyze labels via Google Gemini API multimodal vision, detect barcodes, and validate all 10 mandatory declarations — identifying non-compliances and violations in seconds.

---

## 🏅 Tech Stack — At a Glance

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Google Gemini](https://img.shields.io/badge/Google%20Gemini-8E75B2?style=for-the-badge&logo=googlegemini&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

---

## 🛠️ Technology Stack & AI Architecture

| 🔧 Component | 💻 Technology | 📝 Responsibilities & Description |
| :--- | :--- | :--- |
| **Google Gemini API** | Google Gemini Vision API (`gemini-1.5-flash`) | Performs direct multimodal image understanding, character recognition, and structured declaration parsing on uploaded product packaging images. |
| **Frontend UI & Views** | TypeScript, React 19, Tailwind CSS | Responsive inspection dashboard, grid form editor, live rules checklists, and dark mode interface. |
| **Backend & REST APIs** | JavaScript (Node.js) | Vercel Serverless Functions for inspection persistence (`/api/products`), single product queries (`/api/products/:id`), and serverless AI proxy (`/api/vision/ocr`). |
| **Database & Persistence** | MongoDB Atlas NoSQL | Cloud-hosted NoSQL document database storing inspection logs, compliance scores, and evidence photos. |
| **Authentication & Security** | JWT (`jsonwebtoken`), `bcryptjs` | Role-based user authentication and password salting/hashing. |
| **Report Generation & PDF** | CSS3 (`@media print`), JavaScript | Official digital compliance inspection certificates with print-to-PDF export. |

---

## ✨ Key Features

### 1. 🔍 Multi-Modal AI Packaging Scanner & Navigation
- **⚡ Top-Right Instant Access**: Directly launch the packaging scanner from anywhere in the app with the persistent "Add / Scan Product" header action.
- **📷 Camera Scan**: Real-time camera viewfinder with alignment guide and Gemini AI Multimodal Vision extraction.
- **📤 Image Upload & Drag-and-Drop**: Modern drag-and-drop dropzone supporting JPG, PNG, and WEBP files up to 25 MB with live lifecycle stepper.
- **✍️ Interactive Declarations Grid**: Real-time form with dynamic fields tailored to specific product categories (Net Quantity, MRP, Unit Sale Price, Mfg Date, Expiry, Manufacturer, Regulatory Licenses, Origin).

### 2. ⚖️ Category-Aware Compliance Engine (Rules, 2011 & Sectoral Statutes)
Dynamically validates statutory declarations tailored across **8 regulated product categories**:
- 🥗 **Food & Beverage**: Mandatory 14-digit FSSAI license & date of packing / best before.
- 💄 **Cosmetics & Personal Care**: Cosmetics manufacturing / import license & ingredient disclosures.
- 💊 **Drugs & Pharmaceuticals**: Drug manufacturing / retail license, batch numbers & expiry.
- ⚡ **Electrical / Electronic Appliances**: BIS CRS / ISI registration and safety standards.
- 🧸 **Toys**: BIS Toy Safety License & age classification warnings.
- 👕 **Textiles & Garments**: Fiber composition, size designation, and manufacturer details.
- 🩺 **Medical Devices**: CDSCO Medical Device manufacturing / import license.
- 📦 **General Packaged Commodities**: Comprehensive Legal Metrology (Packaged Commodities) Rules, 2011 compliance.

### 3. 📄 Universal Dual Export Engine (DOCX & PDF)
- **📝 Entire Products Registry DOCX Master Export**: Download the complete product registry dataset as a beautifully formatted, editable Microsoft Word (`.docx`) table in landscape orientation with repeated headers, comprehensive field audits, and compliance breakdowns.
- **📑 Single-Product Word Report (.DOCX)**: Export editable individual compliance inspection reports using native Microsoft Word format.
- **📜 Digital PDF Certificates**: Generate official compliance inspection certificates with scores, timestamps, and inspector field notes.
- **📊 Filtered PDF Summaries**: Instant summary reports for listed inspection records.

### 4. 🌗 Full Dark / Light Theme System
- Live theme switching between sleek dark mode and vibrant light mode across all cards, forms, inputs, and modals without full page reloads.

### 5. 📊 Enforcement Dashboard & Barcode Verification
- **Real-Time GTIN Validation**: Validates GTIN-8, GTIN-12, GTIN-13, and GTIN-14 check digits.
- **Dynamic Score Counter**: Calculates compliance score in real time based on active category rules.
- **Persistent Cloud Registry**: Searchable MongoDB Atlas database with instant category and status filters (`Compliant`, `Partially Compliant`, `Non-Compliant`).

---

## ⚙️ Environment Variables

Configure the following environment variables in your local `.env` file or in Vercel Project Settings:

```env
# MongoDB Atlas Database URI (Required)
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/labellens

# JWT Secret Key (Required)
JWT_SECRET=your-secure-jwt-secret

# Google Gemini API Key (Required / Production AI Multimodal Vision)
GEMINI_API_KEY=your-gemini-api-key-from-google-ai-studio
```

---

## 🚀 Local Development Setup

### 1. Clone the repository
```bash
git clone https://github.com/Srujan-AI-ML/Label-Lens.git
cd Label-Lens
```

### 2. Install dependencies
```bash
npm install
```

### 3. Run the development server
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

### 4. Build for production
```bash
npm run build
```

---

## 🌐 Production & Vercel Deployment

1. Push your code to GitHub:
   ```bash
   git push origin main
   ```
2. Link the repository to your Vercel account.
3. Add `MONGODB_URI`, `JWT_SECRET`, and `GEMINI_API_KEY` in **Vercel → Project Settings → Environment Variables**.
4. Redeploy to update the live production environment.

---

## 👤 Author

| Field | Details |
|---|---|
| **Name** | Srujan |
| **GitHub** | [Srujan-AI-ML](https://github.com/Srujan-AI-ML) |
| **Repository** | [Label-Lens](https://github.com/Srujan-AI-ML/Label-Lens) |

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
