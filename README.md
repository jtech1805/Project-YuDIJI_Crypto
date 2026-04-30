# ⚡ YuJiDi: Real-Time AI Risk Intelligence Platform

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-43853D?style=flat&logo=node.js&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=flat&logo=mongodb&logoColor=white)

**YuJiDi** is an institutional-grade, real-time cryptocurrency volatility scanner and AI risk agent. It ingests high-frequency market streams, applies quantitative anomaly detection, and orchestrates a Retrieval-Augmented Generation (RAG) pipeline to deliver sub-second, deterministic root-cause analysis to connected clients.

## 🚀 Core Features

* **High-Frequency Data Ingestion:** Maintains a resilient, single-source-of-truth WebSocket connection to the Binance stream, mitigating rate limits while processing thousands of ticks per second.
* **Quantitative Anomaly Detection:** Utilizes localized mathematical filters to detect significant market deviations (e.g., localized flash crashes or liquidity spikes) against user-defined rolling thresholds.
* **Deterministic AI RAG Pipeline:** Upon threshold breach, dynamically injects live order-book depth and vector-searched financial news into **Groq's LLaMA 3** inference engine, returning human-readable, non-hallucinated context.
* **Pub/Sub Fan-Out Architecture:** Broadcasts localized AI intelligence to thousands of concurrent clients via a highly optimized WebSocket registry, ensuring \(O(1)\) ingestion cost regardless of client load.
* **Resilient Session Management:** Implements strict cross-domain JWT authentication with automated socket teardown tightly coupled to the auth lifecycle, preventing server OOM (Out of Memory) leaks.

## 🧠 System Architecture

The platform operates on a decoupled architecture, separating raw data ingestion from intelligent state broadcast.
```text
[Binance WS Stream] ──(Raw Ticks)──> [YuJiDi Quant Engine] 
                                            │
                                      (Threshold Breach)
                                            │
                                            ▼
[MongoDB Vector Search] <──(News/Context)── [RAG Pipeline] ──(Order Book Depth)──> [Groq LLM]
                                            │
                                      (AI Risk Alert)
                                            │
                                            ▼
                               [WebSocket Fan-Out Broadcaster]
                                     /      │      \
                               [Client]  [Client]  [Client]




🛠 Tech Stack
Frontend (Client)
Framework: React 18 (Vite)

Language: TypeScript (Strict Mode)

Styling & Animation: Tailwind CSS v4, Framer Motion

Authentication: Google Identity Services (OAuth2)

Backend (Server)
Runtime: Node.js (Express.js)

Real-Time: Native ws (WebSockets)

Database & Vector Store: MongoDB Atlas (Mongoose + Atlas Vector Search)

AI Inference: Groq Cloud API

Security: Zod (Schema Validation), HTTP-Only Cross-Domain JWTs

⚙️ Prerequisites
Before you begin, ensure you have met the following requirements:

Node.js: v18.0.0 or higher

MongoDB: An active MongoDB Atlas cluster with Vector Search enabled.

Groq API Key: For high-speed LLM inference.

Google Cloud Console: Client ID for OAuth integration.

💻 Local Development Setup
1. Clone the repository
Bash
git clone [https://github.com/your-username/yujidi.git](https://github.com/your-username/yujidi.git)
cd yujidi
2. Install dependencies
Install dependencies for both the client and the server.

Bash
# Install Server dependencies
cd server
npm install

# Install Client dependencies
cd ../client
npm install
3. Environment Configuration
Create a .env file in the server directory:

Code snippet
# Server Config
PORT=8080
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# Database
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/yujidi

# Authentication
JWT_SECRET=your_super_secret_jwt_key
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com

# AI Integration
GROQ_API_KEY=gsk_your_groq_api_key
Create a .env file in the client directory:

Code snippet
VITE_API_URL=http://localhost:8080
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
4. Start the Application
You can run the client and server concurrently.

Terminal 1 (Server):

Bash
cd server
npm run dev
Terminal 2 (Client):

Bash
cd client
npm run dev
The frontend will be available at http://localhost:5173.
