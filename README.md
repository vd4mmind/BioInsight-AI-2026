
# BioInsight.AI

A live scientific intelligence platform tracking CVD, CKD, MASH, Diabetes, and Obesity.

## Setup Instructions

This application requires a Gemini API key to run the live analysis streams.

**Local Development**:
Create a `.env` or `.env.local` file in the root directory:
```env
GEMINI_API_KEY=your_actual_api_key_here
```

**Server-Side Deployment** (e.g., Cloud Run, Vercel, Node server):
Configure the `GEMINI_API_KEY` environment variable in your deployment environment's settings. 

The application uses a secure backend proxy to ensure the key is never exposed to the client.

## 🚀 Version 2.3: Registry-Aware Intelligence
* **RWE Aggregation**: Now scans federated EHR registries including **Veradigm, Truveta, TriNetX, CPRD, and Optum**.
* **Parallel Swarm Architecture**: Launches concurrent Google Search grounding queries across 5 distinct journal clusters (Nature/NEJM/Lancet, JAMA/Science/Cell, Society Journals, Wiley/Elsevier, and Springer/PubMed) per active topic, streaming results to the UI instantly as each batch resolves.
* **Shadow Literature Detection**: Captured industry-led white papers and real-world GLP-1 adherence reports.
* **Semantic Anchors**: High-recall methodology tracking for Claims Analysis and Federated EHR studies.
* **Fallback Tolerant Parsing**: Employs multiple stages of JSON block extraction and inline bracket matching for robust handling of confidence intervals in free text.

---
*Developed by Vivek Das • Built with Google Gemini 2.5 Flash*
