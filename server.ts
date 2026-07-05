import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { fetchLiteratureAnalysisStream, fetchAiAnalysisStream, fetchPatentStream } from "./server/geminiLogic";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Simple IP rate limiter
  const rateLimitMap = new Map<string, { [feedType: string]: number }>();

  const checkRateLimit = (ip: string, feedType: string): boolean => {
    const now = Date.now();
    let ipData = rateLimitMap.get(ip);
    if (!ipData) {
      ipData = {};
      rateLimitMap.set(ip, ipData);
    }
    
    const lastRequest = ipData[feedType] || 0;
    if (now - lastRequest < 60000) { // 60 seconds cooldown
      return false;
    }
    
    ipData[feedType] = now;
    return true;
  };

  const requireRateLimit = (feedType: string) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit(ip, feedType)) {
      res.status(429).json({ error: "Rate limit exceeded. Please wait 60 seconds." });
      return;
    }
    next();
  };

  // Helper to stream async generators as NDJSON
  const streamToResponse = async (req: express.Request, res: express.Response, generatorFn: (topics: string[]) => AsyncGenerator<any, void, unknown>) => {
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Transfer-Encoding', 'chunked');
    
    const topics = req.body.topics || [];
    
    try {
      for await (const chunk of generatorFn(topics)) {
        res.write(JSON.stringify(chunk) + '\n');
      }
    } catch (e) {
      console.error("streamToResponse error:", e);
      res.write(JSON.stringify({ error: "Stream interrupted" }) + '\n');
    } finally {
      res.end();
    }
  };

  app.post("/api/live", requireRateLimit("live"), (req, res) => {
    streamToResponse(req, res, fetchLiteratureAnalysisStream);
  });

  app.post("/api/ai", requireRateLimit("ai"), (req, res) => {
    streamToResponse(req, res, fetchAiAnalysisStream);
  });

  app.post("/api/patents", requireRateLimit("patents"), (req, res) => {
    streamToResponse(req, res, fetchPatentStream);
  });

  app.post("/api/polish-link", requireRateLimit("polish"), (req, res) => {
    res.json({ result: null });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
