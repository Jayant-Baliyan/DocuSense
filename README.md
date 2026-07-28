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
- 🧠 **Dual LLM Support** — Google Gemini (primary) + Groq API (failover)
- 🔐 **Secure API Proxy** — LLM keys never exposed to the client
- 🐳 **Dockerized** — Single-container full-stack deployment
- ☁️ **AWS App Runner** — Public endpoint from one build pipeline

---

## 🏗️ Architecture

```mermaid
%%{init: {'theme': 'dark'}}%%
graph TB
    subgraph AWS["☁️ AWS App Runner"]
        subgraph Docker["🐳 Docker Container"]
            subgraph Client["🎨 Next.js Frontend"]
                UI["📄 PDF Upload UI"]
                Chat["💬 Streaming Chat"]
            end

            subgraph Server["⚙️ Express Backend"]
                Proxy["🔐 API Proxy Layer"]
                Parser["📖 PDF Text Parser"]
                Failover["⚡ Failover Controller"]
                SSE["📤 SSE Stream Handler"]
                Security["🛡️ Helmet + CORS"]
                Zod["📝 Zod Validation"]
            end
        end
    end

    subgraph LLM["🧠 LLM Providers"]
        Gemini["🧠 Google Gemini API — Primary"]
        Groq["⚡ Groq API — Failover"]
    end

    User["👤 User"] --&gt; UI
    User --&gt; Chat

    UI --&gt;|POST /upload| Parser
    Chat --&gt;|POST /ask| Zod
    Zod --&gt; Proxy
    Proxy --&gt;|Primary call| Gemini
    Proxy -.-&gt;|Failover| Groq
    Parser --&gt;|Context| Proxy

    Gemini --&gt;|Stream chunks| SSE
    Groq --&gt;|Stream chunks| SSE
    SSE --&gt;|SSE stream| Chat

    Security -.-&gt;|Protects| Proxy
    Security -.-&gt;|Protects| Parser
    Security -.-&gt;|Protects| SSE

    classDef client fill:#1e293b,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0
    classDef server fill:#0f172a,stroke:#6366f1,stroke-width:2px,color:#e2e8f0
    classDef llm fill:#1a1205,stroke:#f59e0b,stroke-width:2px,color:#e2e8f0
    classDef user fill:#1e293b,stroke:#22c55e,stroke-width:2px,color:#e2e8f0

    class UI,Chat client
    class Proxy,Parser,Failover,SSE,Security,Zod server
    class Gemini,Groq llm
    class User user


### Data Flow
1. **Upload** → Next.js frontend sends PDF to Express backend (`POST /upload`)
2. **Parse** → Server extracts and chunks text via PDF parser
3. **Ask** → User question + context forwarded to LLM proxy
4. **Failover** → Gemini primary; auto-switch to Groq on error
5. **Stream** → SSE chunks flow back to frontend progressively

---

## 🛠️ Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14, TypeScript, TailwindCSS |
| Backend | Node.js, Express, TypeScript |
| AI/ML | Google Gemini API, Groq API |
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