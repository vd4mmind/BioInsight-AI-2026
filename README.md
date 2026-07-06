
# <img src="https://api.iconify.design/lucide:activity.svg?color=%230ea5e9" alt="BioInsight.AI Logo" width="32" height="32" align="top"> BioInsight.AI

### The Live Scientific Intelligence Platform
**Powered by Google Gemini 2.5 Flash & Parallel Swarm Intelligence**

BioInsight.AI is a next-generation scientific intelligence platform designed to bridge the gap between static archives and real-time discovery. We track breakthrough research in **Cardiovascular Disease (CVD)**, **Chronic Kidney Disease (CKD)**, **Metabolic Diseases (MASH/NASH/Diabetes/Obesity)**, and **Real-World Evidence (RWE)** using an optimized, cache-backed AI swarm.

> **⚠️ Disclaimer: Research Use Only**  
> BioInsight.AI aggregates and analyzes public scientific data using Generative AI. While we use strict search grounding to verify sources, all findings should be independently verified against the original publication. This tool is not for clinical decision-making.

---

## ✨ Key Capabilities

* **Concurrent Swarm Execution**: Launches one search per active disease topic, run in parallel across topics, against a single consolidated set of allowed academic and journal domains.
* **Real-Time Streaming UI**: Results are streamed to the client immediately as each batch resolves via `Promise.race` logic, providing instant visual feedback.
* **RWE Aggregation**: Specifically targets and captures real-world evidence across federated EHR registries, including Veradigm, Truveta, TriNetX, CPRD, and Optum.
* **Strict Domain Verification**: Enforces a strict post-retrieval domain allowlist to drop industry/consumer sources (news sites, patient-advocacy blogs, trade publications), ensuring only rigorous academic literature is surfaced.
* **Signal Denoising**: Implements "Negative Prompt Tuning" to strictly exclude editorials, generic reviews, and opinion pieces.
* **Fallback Tolerant Parsing**: Employs deep validation, JSON block extraction, and inline bracket matching to ensure stability even when the AI returns unformatted text or confidence intervals in free text.

## 🛠 Technology Stack

* **Frontend**: React 19, Tailwind CSS, Lucide Icons, Recharts
* **Backend**: Node.js / Express (Proxying requests to protect API keys)
* **AI / Agentic Logic**: Google Gemini (`@google/genai` SDK), Google Search Grounding
* **Build System**: Vite & esbuild

## 🚀 Getting Started

This application requires a **Gemini API key** to run the live analysis streams.

### 1. Local Development

Install the dependencies:
```bash
npm install
```

Create a `.env` file in the root directory and add your key:
```env
GEMINI_API_KEY=your_actual_api_key_here
```

Start the development server:
```bash
npm run dev
```

### 2. Server-Side Deployment (e.g., Cloud Run, Vercel)

Configure the `GEMINI_API_KEY` environment variable in your deployment environment's settings. 
The application uses a secure backend proxy to ensure the key is never exposed to the client browser.

To build and run in production mode:
```bash
npm run build
npm start
```

## 📝 Release Notes

### Version 2.4: Deep Mechanism & IP Intelligence
* **Mechanism-First Patent Search**: Implemented a dedicated `PATENT_EXPANSION` strategy that searches for patents using mechanisms of action and molecules (e.g., THR-beta agonists, SGLT2 inhibitors) rather than just disease names, capturing obfuscated IP filings with an expanded 18-month lookback window.
* **Intelligent Topic Disambiguation**: Refined classification logic for shared drug classes (like GLP-1s) where Diabetes receives routing priority when explicitly mentioned, otherwise falling through to Obesity (while CKD requires explicit renal/kidney keywords).
* **Direct Access Link Polisher**: Integrated an AI-driven module that automatically attempts to locate open-access full-text PDFs for discovered papers.

### Version 2.3: Registry-Aware Intelligence
* **RWE Aggregation**: Now scans federated EHR registries.
* **Parallel Swarm Architecture**: Launches concurrent Google Search grounding queries, streaming results to the UI instantly.
* **Unified Liver Disease Tracking**: MASH, NASH, and MASLD are now consolidated into a single high-recall topic channel.
* **Historical Patent Search**: Automatically maps modern terms (MASH) to historical synonyms (NASH) to recover IP records from 2018–2023.

---
*Developed by Vivek Das • Built with Google Gemini 2.5 Flash*
