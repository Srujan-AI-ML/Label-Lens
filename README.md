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

### 1. 🔍 Multi-Modal AI Packaging Scanner
- **📷 Camera Scan**: Real-time camera viewfinder with alignment guide and Gemini AI extraction.
- **📤 Image Upload**: Drag-and-drop or file upload for high-resolution packaging photos and evidence.
- **✍️ Mandatory Specifics Grid**: Interactive, emoji/icon-rich grid to manually fill or edit declaration specifics (Net Weight, MRP, Mfg Date, Expiry, Manufacturer, FSSAI, Consumer Care, Origin, USP).

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

### 3. 📊 Enforcement Dashboard & Live Compliance Score
- **Real-Time Side Box**: Displays the **Rules 2011 Checklist** with **Green Ticks (✔️ Pass)** for compliant fields and **Red Crosses (❌ Fail)** for missing or invalid declarations.
- **Dynamic Score Counter**: Calculates compliance score in real time based on actual validated form states and extracted label data.
- **Persistent Database Registry**: Searchable product registry with status filters (`Compliant`, `Partially Compliant`, `Non-Compliant`).
- **Official PDF Certificates**: Instant print/export for digital inspection certificates with inspector field notes.

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
