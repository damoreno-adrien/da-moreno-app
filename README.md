# Da Moreno - Operations & Order Management Portal

An internal, serverless web application designed to streamline daily operations, staff management, supplier tracking, and order processing across multiple branches. 

## 🛠 Tech Stack

*   **Frontend:** HTML5, Vanilla JavaScript (ES Modules)
*   **Styling:** Tailwind CSS (CDN)
*   **Backend & Database:** Firebase (Firestore, Firebase Auth)
*   **Architecture:** Serverless, Single Page Application (SPA) principles via `CustomEvent` context switching.
*   **Hosting:** Designed for Vercel / Firebase Hosting.

## ✨ Core Features

### 1. Role-Based Access Control (RBAC)
*   **SuperAdmin:** Full access across all branches. Capable of executing irreversible actions (Hard Deletes), managing Admins/SuperAdmins, and viewing global metrics.
*   **Admin:** Branch-specific management. Can manage local staff, process orders, and edit local operational data. Cannot escalate privileges.
*   **Staff:** Restricted access strictly for creating and tracking personal/departmental orders via the Front-End interface.

### 2. Multi-Branch & Department Architecture
*   Dynamic context switching for SuperAdmins to view data from specific branches without reloading the page (Event-Driven SPA).
*   Hierarchical organization: Branches -> Departments -> Staff.

### 3. Order Processing Engine
*   **Front-End:** Streamlined interface for staff to place internal orders.
*   **Admin Panel:** 
    *   Live tracking of "Pending" orders via notification badges.
    *   Automated aggregation of ordered items by Supplier and Branch.
    *   1-Click generation of formatted text lists for supplier communication (Line/WhatsApp).
    *   Partial processing logic (Splitting orders when only some items are processed).
    *   Manual order injection for fast-tracking.

### 4. Supplier & Catalog Management
*   **Lifecycle Management:** Active/Inactive toggles, Archiving (Soft Delete) for historical integrity, and Hard Delete (SuperAdmin only).
*   **Quick View:** Virtual business card modal for suppliers with 1-click clipboard copy and high-resolution JPG export (via `html2canvas`).
*   **Batch Operations:** Deactivating or archiving a supplier automatically cascades the status to all their associated products via Firestore `writeBatch`.

### 5. Internationalization (i18n)
*   Native support for multiple languages (English, Thai).
*   Dynamic UI language switching with persistent `localStorage` preferences.

## 🚀 Local Development Setup

1. **Clone the repository:**
   \`\`\`bash
   git clone [repository-url]
   cd [repository-folder]
   \`\`\`

2. **Environment Configuration:**
   Ensure your Firebase configuration is correctly set up in `js/config.js`.
   \`\`\`javascript
   // js/config.js
   const firebaseConfig = {
       apiKey: "YOUR_API_KEY",
       authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
       projectId: "YOUR_PROJECT_ID",
       storageBucket: "YOUR_PROJECT_ID.appspot.com",
       messagingSenderId: "YOUR_SENDER_ID",
       appId: "YOUR_APP_ID"
   };
   \`\`\`

3. **Run a Local Server:**
   Because the app utilizes ES Modules (\`type="module"\`), it must be served via HTTP, not the \`file://\` protocol.
   
   Using Node.js (\`npx\`):
   \`\`\`bash
   npx serve -p 3000
   \`\`\`
   
   *Alternatively, use the "Live Server" extension in VS Code.*

4. **Access the App:**
   Open \`http://localhost:3000/\` in your browser.

## 🔒 Security Notes
*   **Privilege Escalation:** The UI strictly blocks Admins from assigning or modifying SuperAdmin/Admin roles.
*   **Firestore Rules:** Ensure your Firebase Security Rules match the RBAC logic enforced in the UI to prevent unauthorized API-level access.