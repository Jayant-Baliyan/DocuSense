# DocuSense — AI-Powered Document Analyzer

[![Live Demo](https://img.shields.io/badge/Live%20Demo-16.16.104.64-blue)](http://16.16.104.64)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Docker](https://img.shields.io/badge/Docker-Containerized-2496ED)
![AWS](https://img.shields.io/badge/AWS-App%20Runner-FF9900)

A full-stack AI document Q&A platform that lets users upload PDFs and ask questions in natural language, with answers streamed progressively in real time.

🔗 **Live Demo:** [http://16.16.104.64](http://16.16.104.64)

---

## ✨ Features

- 📄 **PDF Upload & Parsing** — Extract and chunk text server-side
- 💬 **Streaming Q&A** — Real-time SSE responses for instant feedback
- 🧠 **Dual LLM Support** — Google Gemini (primary) + Grok/xAI (failover)
- 🔐 **Secure API Proxy** — LLM keys never exposed to the client
- 🐳 **Dockerized** — Single-container full-stack deployment
- ☁️ **AWS App Runner** — Public HTTPS endpoint from one build pipeline

---

## 🏗️ Architecture

![Architecture](architecture.svg)

### Data Flow
1. **Upload** → Next.js frontend sends PDF to Express backend (`POST /upload`)
2. **Parse** → Server extracts and chunks text via PDF parser
3. **Ask** → User question + context forwarded to LLM proxy
4. **Failover** → Gemini primary; auto-switch to Grok/xAI on error
5. **Stream** → SSE chunks flow back to frontend progressively

---

## 🛠️ Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14, TypeScript, TailwindCSS |
| Backend | Node.js, Express, TypeScript |
| AI/ML | Google Gemini API, Grok/xAI API |
| Security | Helmet, CORS, Zod validation |
| DevOps | Docker, AWS App Runner |

---

## 🚀 Quick Start

```bash
# Clone
git clone https://github.com/Jayant-Baliyan/DocuSense.git
cd DocuSense

# Run with Docker
docker build -t docusense .
docker run -p 3000:3000 docusense