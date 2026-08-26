# Label Lens - Hackathon Q&A & FAQ Sheet

**Author:** Srujan  
**Contact:** asgaladechronicles@gmail.com  
**Purpose:** Pitch preparation and answering questions from hackathon judges during presentation sessions.

---

## 🙋‍♂️ Top Hackathon Questions & Prepared Answers

### Q1: How does your application accurately verify the physical font size (e.g. 2 mm height) from a digital 2D image?
**Answer:** In a live deployment, inspectors use a calibration card (such as a standard reference marker/sticker placed beside the packaging label, or scanning with a fixed camera distance). For this hackathon implementation, the engine analyzes the text density and layout using OCR character bounding box ratios. Under Legal Metrology Rule 13, minimum letter height is determined by package mass. The system parses the net quantity (e.g., `250 g`), calculates the minimum required letter height in millimeters, and checks OCR confidence levels. If the text is too small or blurry to be parsed with high confidence, the system immediately flags a **Readability / Font Size Check** violation.

### Q2: What is the scoring system, and how do you prevent false compliance scores when details are missing?
**Answer:** The scoring system assigns weights to Legal Metrology checks totaling 100%:
*   **7 Critical Checks (12 points each - 84 points total):** Product Name, Manufacturer Address, Net Quantity, Manufacture Date, MRP, Helpline details, and Expiry Date.
*   **2 Major Checks (6 points each - 12 points total):** FSSAI License Number and Country of Origin.
*   **1 Minor Check (4 points - 4 points total):** Retail Sale Price breakdown.

The app uses strict validation bindings. If the inspector leaves a field empty in the verification modal, or if the OCR fails to find the data, the score immediately decreases. A product only reaches **"Compliant" (100%)** when all 10 fields are present and valid. Any score between 1% and 99% is marked as **"Partially Compliant"**, and 0% is **"Non-Compliant"**.

### Q3: How does the application handle data privacy and security?
**Answer:** User login is authenticated using standard JSON Web Tokens (JWT) encrypted with HS256, or verified directly using secure Google OAuth client tokens. Passwords stored in MongoDB Atlas are hashed using salt rounds via `bcryptjs`. Sensitive configurations and API keys are stored strictly in environment variables on Vercel's serverless endpoints, ensuring credentials are never exposed to clients.

### Q4: How is this viable for deployment across a country like India with poor network coverage in rural markets?
**Answer:** The app uses local browser-based fallbacks for essential features:
*   The scanner includes canvas-based local date parsing using regular expressions.
*   The barcode engine uses the browser's native local `BarcodeDetector` API.
*   The UI leverages React's context states to cache records, meaning an inspector can scan several products in a low-coverage warehouse and sync them to the MongoDB Cloud database once they reconnect to the internet.

### Q5: How can a government agency act upon the data collected by Label Lens?
**Answer:** 
1.  **Notice Issuance:** Inspectors can immediately export the generated compliance report as a PDF directly from the dashboard and issue a notice to the manufacturing address extracted by the app.
2.  **Audit Trail:** Every scan registers a permanent timestamped database record, creating a tamper-proof audit log of inspections for court cases.
3.  **Targeted Enforcement:** The government dashboard visualizes trends, identifying which brands or manufacturing zones have the highest non-compliance rates so regulatory bodies can target inspections where violations are most common.
