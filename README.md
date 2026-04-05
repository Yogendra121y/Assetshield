# 🛡️ Vigil — AI-Powered Digital Asset Protection System

> **Team Vigil · H2S Solution Challenge 2026 · GDG on Campus / Hack2skill**

Vigil is a production-ready MVP that allows sports organizations to upload digital media, generate unique perceptual fingerprints, detect unauthorized usage via AI similarity matching, and visualize results in a professional dashboard.

---























## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client (React)                       │
│  Login → Upload → Dashboard → Asset Detail                  │
└───────────────────────┬─────────────────────────────────────┘
                        │ Firebase Auth (ID Token)
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              Backend API (Node.js + Express)                │
│  POST /upload → POST /analyze → GET /assets → GET /stats   │
└───────┬──────────────────────────────────┬──────────────────┘
        │                                  │
        ▼                                  ▼
┌───────────────┐                ┌──────────────────────────┐
│ Cloud Storage │                │   AI Service             │
│ (media files) │                │  aHash + Cosine Sim      │
└───────────────┘                │  Hamming Distance        │
        │                        └──────────┬───────────────┘
        ▼                                   │
┌───────────────┐                           ▼
│   Firestore   │◄──────────────────────────┘
│  users/assets │  (fingerprint + score written back)
└───────────────┘
        │ Pub/Sub (simulated)
        ▼
  🚨 Alert System
```

---


















## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Firebase project with Firestore, Auth, and Storage enabled
- Google Cloud project (for Cloud Run deployment)

---

### 1. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project
3. Enable:
   - **Authentication** → Sign-in methods: Email/Password + Google
   - **Firestore Database** → Start in production mode
   - **Storage** → Start in production mode
4. Download your **Service Account JSON** (Project Settings → Service Accounts → Generate new private key)
5. Register a **web app** to get your `firebaseConfig` values

**Firestore Security Rules** (paste in Firebase Console):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /assets/{assetId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null;
    }
  }
}
```

**Storage Security Rules**:
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /assets/{userId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

### 2. Frontend Setup

```bash
cd frontend
cp .env.example .env
# Fill in your Firebase credentials in .env
npm install
npm run dev
# → http://localhost:5173
```

---

### 3. Backend Setup

```bash
cd backend
cp .env.example .env
# Set FIREBASE_SERVICE_ACCOUNT_JSON or place service-account.json in /backend
npm install
npm run dev
# → http://localhost:5000
```

---

### 4. Run Both Together (Dev)

```bash
# Terminal 1
cd frontend && npm run dev

# Terminal 2
cd backend && npm run dev
```

The Vite dev server proxies `/api/*` → `http://localhost:5000/*` automatically.

---


























## 📁 Project Structure

```
vigil-dap/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/
│   │   │   ├── dashboard/
│   │   │   │   ├── AssetCard.jsx       ← Media asset card with status
│   │   │   │   ├── AlertBanner.jsx     ← Flagged asset alert
│   │   │   │   └── StatCard.jsx        ← KPI metric card
│   │   │   └── shared/
│   │   │       └── AppLayout.jsx       ← Sidebar + main layout
│   │   ├── context/
│   │   │   ├── AuthContext.jsx         ← Firebase auth state
│   │   │   └── ThemeContext.jsx        ← Dark/light mode
│   │   ├── hooks/
│   │   │   └── useAssets.js            ← Real-time Firestore listener
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── RegisterPage.jsx
│   │   │   ├── DashboardPage.jsx       ← Charts + asset grid
│   │   │   ├── UploadPage.jsx          ← Drag & drop upload
│   │   │   └── AssetDetailPage.jsx     ← Full asset view + re-analyze
│   │   └── services/
│   │       ├── firebase.js             ← Firebase SDK init
│   │       ├── api.js                  ← Axios client
│   │       └── exportPDF.js            ← jsPDF report export
│   ├── Dockerfile
│   └── nginx.conf
│
├── backend/
│   ├── server.js                       ← Express entry point
│   ├── routes/
│   │   ├── auth.js
│   │   ├── upload.js
│   │   ├── assets.js
│   │   ├── analyze.js
│   │   └── stats.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── uploadController.js
│   │   ├── assetsController.js
│   │   └── analyzeController.js        ← AI pipeline orchestrator
│   ├── services/
│   │   ├── firebase.js                 ← Firebase Admin SDK
│   │   ├── fingerprintService.js       ← aHash + SHA-256
│   │   └── similarityService.js        ← Matching against dataset + DB
│   ├── middleware/
│   │   └── auth.js                     ← Firebase token verification
│   └── Dockerfile
│
├── ai-service/
│   ├── app.py                          ← FastAPI AI microservice
│   ├── engine.py                       ← Hashing + embeddings + video matching
│   ├── requirements.txt                ← Python dependencies
│   └── similarity.js                   ← Legacy Node similarity utility
│
└── README.md
```

---






















## 🔌 API Reference

| Method | Endpoint        | Auth | Description                        |
|--------|-----------------|------|------------------------------------|
| POST   | `/auth/register`| Yes  | Persist user doc to Firestore      |
| POST   | `/auth/login`   | Yes  | Return user profile                |
| POST   | `/upload`       | Yes  | Upload media → generate fingerprint|
| GET    | `/assets`       | Yes  | List all user assets               |
| GET    | `/assets/:id`   | Yes  | Get single asset                   |
| DELETE | `/assets/:id`   | Yes  | Delete asset + storage file        |
| POST   | `/analyze`      | Yes  | Trigger AI similarity analysis     |
| GET    | `/stats`        | Yes  | Aggregate stats for dashboard      |
| GET    | `/health`       | No   | Cloud Run health check             |

---




























## 🤖 AI Pipeline

```
Upload file
    │
    ▼
Backend orchestrator (/analyze)
  ├─ Generates source fingerprint if missing
  ├─ Calls Python AI Service (/analyze)
  │   ├─ Images: pHash + embedding
  │   └─ Videos: keyframe extraction every 1s + image pipeline
  └─ Falls back to Node similarity service if AI service is unavailable
    │
    ▼
Similarity scoring
  ├─ Hamming similarity (hash)
  ├─ Cosine similarity (embedding)
  └─ Weighted combined score
    │
    ▼
score >= 80% → status = "flagged" 🚨
score <  80% → status = "safe"   ✅
    │
    ▼
Write result to Firestore
    │
    ▼ (if flagged)
Simulate Pub/Sub publish → console alert
```

**Run the Python AI service:**
```bash
cd ai-service
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
# source .venv/bin/activate

pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000
```

**Quick local AI API test:**
```bash
curl http://127.0.0.1:8000/health
```

Backend uses `AI_SERVICE_URL` (default `http://127.0.0.1:8000`) to call this service.
Set `AI_DATASET_FOLDER` in `backend/.env` if you want local scraped dataset matching in addition to app asset matching.
Backend can auto-warm the AI index on startup using `AI_WARMUP_ON_START=true` (with retries controlled by `AI_WARMUP_RETRIES`).

**Example AI response JSON:**
```json
{
  "status": "POTENTIAL MISUSE",
  "similarity": 87.5,
  "matched_file": "image_12.jpg",
  "matched_id": "asset_12"
}
```

**Generate a realistic sample dataset:**
```bash
cd ai-service
python tools/create_augmented_dataset.py --input ./seed_images --output ./sample_dataset
```

---
























## ☁️ Cloud Run Deployment

### Backend

```bash
cd backend

# Build & push Docker image
gcloud builds submit --tag gcr.io/YOUR_PROJECT/vigil-backend

# Deploy to Cloud Run
gcloud run deploy vigil-backend \
  --image gcr.io/YOUR_PROJECT/vigil-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "FIREBASE_PROJECT_ID=YOUR_ID,FIREBASE_STORAGE_BUCKET=YOUR_BUCKET,FIREBASE_SERVICE_ACCOUNT_JSON=$(cat service-account.json | jq -c .)"
```

### Frontend

```bash
cd frontend

# Update VITE_API_URL to your Cloud Run backend URL
echo "VITE_API_URL=https://vigil-backend-xxxx-uc.a.run.app" >> .env.production

# Build static files
npm run build

# Deploy to Firebase Hosting
firebase deploy --only hosting
```

Or build the Docker image and deploy to Cloud Run as well.

---

## 📊 Firestore Schema

```
users/{uid}
  uid:          string
  email:        string
  displayName:  string
  photoURL:     string
  plan:         "free" | "pro"
  assetsCount:  number
  createdAt:    timestamp

assets/{assetId}
  userId:          string  (ref to users)
  fileName:        string
  fileType:        string  (MIME type)
  fileSize:        number  (bytes)
  fileUrl:         string  (public GCS URL)
  storagePath:     string  (GCS object path)
  fingerprint:     string  (hex hash)
  status:          "processing" | "safe" | "flagged"
  similarityScore: number  (0–100)
  matchedAssetId:  string | null
  matchedAssetName: string | null
  createdAt:       timestamp
  analyzedAt:      timestamp | null
```

---

## 🎨 Tech Stack

| Layer       | Technology                        |
|-------------|-----------------------------------|
| Frontend    | React 18, Vite, Tailwind CSS      |
| Animation   | Framer Motion                     |
| Charts      | Recharts                          |
| Auth        | Firebase Authentication           |
| Database    | Firebase Firestore (real-time)    |
| Storage     | Firebase/GCS Storage              |
| Backend     | Node.js, Express.js               |
| AI Hashing  | sharp (perceptual aHash)          |
| PDF Export  | jsPDF + jsPDF-AutoTable           |
| Deployment  | Google Cloud Run + Firebase Host  |
| Fonts       | Syne (display), DM Sans (body)    |

---















## 🏆 Hackathon Notes

- **Real-time updates** — Firestore `onSnapshot` listener updates the dashboard live as analysis completes
- **Processing state** — Assets show "Processing…" with animated dot immediately after upload
- **Pub/Sub simulation** — The analyze controller logs structured Pub/Sub messages to stdout; swap `simulatePubSubAlert()` with `@google-cloud/pubsub` for production
- **Vertex AI upgrade** — Replace `imageToEmbedding()` in `ai-service/similarity.js` with `@google-cloud/aiplatform` Multimodal Embedding API calls
- **DMCA workflow** — Flagged assets surface with a "Potential Misuse Detected" card and action buttons; wire `matchedAssetName` into an email template for auto-DMCA

---



















*Built by Team Vigil for the H2S Solution Challenge 2026*
#   A s s e t s h i e l d 
 
 
