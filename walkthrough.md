# Walkthrough: DocuSense Full-Stack Dockerization & Streaming

We have completed the transition of **DocuSense** into a containerized full-stack application featuring progressive Q&A streaming (supporting both Gemini and Groq) and a secure Node.js Express backend.

---

## What Was Accomplished

### 1. Dedicated Express Backend (`server.js`)
* Configured a working Express backend on port `3001`.
* Implemented text parsing (`pdf-parse`) and isolated sensitive environment configurations on the server-side.
* Handled the multi-part upload endpoint `/api/analyze`.
* Designed `/api/chat/stream` to stream answers progressively.

### 2. Dual Gemini & Groq Streaming Support & Automatic Failover
* Automatically detects the presence of `GEMINI_API_KEY` and `GROQ_API_KEY` to choose the active model and execute automatic failover if primary fails.
* Integrates standard Groq OpenAI-compatible SSE chunk-by-chunk stream parsing (`llama-3.3-70b-versatile`) and converts it to raw text chunks for the client.
* Simulates typed stream delivery in Mock/Demo mode so users can verify responsiveness without requiring API keys.

### 3. Frontend Stream Parsing (`src/components/QAInterface.tsx`)
* Updated the React chat module to fetch from the streaming API endpoint (`/api/chat/stream`).
* Built a progressive stream decoder utilizing `ReadableStream` and `TextDecoder` to update state on each chunk arrival.

### 4. Next.js Routing & Rewrites (`next.config.ts`)
* Configured internal rewrites to reverse-proxy `/api/:path*` to `http://127.0.0.1:3001/api/:path*`.
* Ensures all keys are kept secure and never exposed to the client side.

### 5. Multi-Process Dockerization (`Dockerfile`, `.dockerignore`)
* Created a Docker configuration running Next.js (front-end) and Express (back-end) concurrently in a single Alpine container.
* Verified that the project compiles cleanly using `npm run build`.

---

## Deployment & Verification Guide

### 1. Local Run
To run the server locally:
```bash
npx concurrently "node server.js" "npm run dev"
```
Open `http://localhost:3000` to test both file analysis and streaming chats.

### 2. Local Docker Test
Build and run the Docker image:
```bash
docker build -t docusense .
docker run -p 3000:3000 --env GEMINI_API_KEY=your_key_here --env GROQ_API_KEY=your_groq_key_here docusense
```

### 3. AWS App Runner Deployment
1. Push your repository to **GitHub**.
2. Navigate to **AWS App Runner** in the AWS console and click **Create Service**.
3. Link your GitHub repository and select the **Docker** runtime option (App Runner will automatically detect and execute the `Dockerfile`).
4. Under **Configuration > Environment Variables**, define:
   * `GEMINI_API_KEY` (and/or `GROQ_API_KEY` / `AI_PROVIDER`)
5. Deploy. App Runner will deploy your container, map port 3000, attach a SSL certificate, and give you a public HTTPS endpoint.
