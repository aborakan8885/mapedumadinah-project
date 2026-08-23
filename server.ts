import express from "express";
import path from "path";
import cors from "cors";
import fs from "fs/promises";

import multer from "multer";

const app = express();
const PORT = 3000;

// Local DB Paths
const DB_DIR = path.join(process.cwd(), "data");
const UPLOADS_DIR = DB_DIR; // Use data/ directly as requested
const FILES_DB = path.join(DB_DIR, "files.json");
const FEEDBACK_DB = path.join(DB_DIR, "feedback.json");

// Configure Multer for local storage
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await fs.mkdir(UPLOADS_DIR, { recursive: true });
      cb(null, UPLOADS_DIR);
    } catch (err) {
      cb(err as Error, UPLOADS_DIR);
    }
  },
  filename: (req, file, cb) => {
    // Sanitize filename and add timestamp to avoid collisions
    const safeName = file.originalname.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

async function initDB() {
  try {
    await fs.mkdir(DB_DIR, { recursive: true });
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    try { await fs.access(FILES_DB); } catch { await fs.writeFile(FILES_DB, "[]"); }
    try { await fs.access(FEEDBACK_DB); } catch { await fs.writeFile(FEEDBACK_DB, "[]"); }
    console.log(">>> [LOCAL DB] Initialized successfully.");
  } catch (err) {
    console.error(">>> [LOCAL DB] Init failed:", err);
  }
}

async function startServer() {
  const isProd = process.env.NODE_ENV === "production" || process.env.NODE_ENV === "PROD";
  console.log(`>>> [SERVER] Starting initialization in ${isProd ? 'PRODUCTION' : 'LOCAL'} MODE...`);
  await initDB();
  
  app.use(cors());
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  // --- HEALTH CHECK ---
  app.get("/api/health", (req, res) => res.json({ status: "ok", mode: isProd ? "production" : "development" }));

  // --- DIAGNOSTIC LOGGING ---
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  // --- LOCAL AUTH API ---
  app.post("/api/admin/login", (req, res) => {
    const { secret } = req.body;
    console.log(`>>> [AUTH] Login attempt. Secret type: ${typeof secret}, Body:`, req.body);
    
    const cleanSecret = String(secret || "").trim();
    if (cleanSecret === "1068575628") {
      console.log(">>> [AUTH] Login SUCCESS for admin-local");
      return res.json({ 
        success: true, 
        bypass: true, 
        user: { 
          id: 'admin-local', 
          role: 'admin', 
          email: 'aborakan8885@gmail.com' 
        } 
      });
    }
    console.warn(`>>> [AUTH] Login FAILED for secret: [${cleanSecret}]`);
    res.status(403).json({ error: `الرقم المستلم [${cleanSecret}] غير مسجل كمسؤول` });
  });

  // --- LOCAL UPLOAD API (Standard Multipart) ---
  const handleUpload = async (req: any, res: any) => {
    console.log(">>> [UPLOAD] Request received at", req.originalUrl);
    const { secret, metadata } = req.body;
    const cleanSecret = String(secret || "").trim();
    
    // In local mode we can be more lenient or check the specific bypass
    if (cleanSecret !== "1068575628") {
        console.warn(">>> [UPLOAD] Unauthorized attempt with secret:", cleanSecret);
        return res.status(403).json({ error: "Unauthorized" });
    }
    
    if (!req.file) {
        console.warn(">>> [UPLOAD] No file in request");
        return res.status(400).json({ error: "No file uploaded" });
    }

    try {
      const fileMetadata = JSON.parse(metadata || '{}');
      const dbContent = await fs.readFile(FILES_DB, "utf-8");
      const dbData = JSON.parse(dbContent);

      const newFileMapping = {
        ...fileMetadata,
        id: fileMetadata.id || Date.now().toString(),
        filename: req.file.originalname,
        localPath: req.file.path,
        serverFilename: req.file.filename,
        uploadedAt: new Date().toISOString()
      };

      // Add to database
      dbData.push(newFileMapping);
      await fs.writeFile(FILES_DB, JSON.stringify(dbData, null, 2));

      console.log(`>>> [LOCAL DB] File uploaded & mapped: ${req.file.originalname}`);
      res.json({ 
        success: true, 
        message: "تم الرفع بنجاح", 
        file: newFileMapping 
      });
    } catch (e: any) {
      console.error("Upload process error:", e);
      res.status(500).json({ error: e.message || "حدث خطأ أثناء معالجة الملف" });
    }
  };

  app.post("/api/admin/upload", upload.single('file'), handleUpload);
  app.post("/api/upload", upload.single('file'), handleUpload); // Alias as requested

  // --- LOCAL FILES API ---
  app.get("/api/files", async (req, res) => {
    try {
      const data = await fs.readFile(FILES_DB, "utf-8");
      res.json(JSON.parse(data));
    } catch (e) {
      res.status(500).json({ error: "Failed to load files" });
    }
  });

  app.post("/api/admin/sync-data", async (req, res) => {
    const { secret, type, file } = req.body;
    const cleanSecret = String(secret || "").trim();
    if (cleanSecret !== "1068575628") return res.status(403).json({ error: "Unauthorized" });

    try {
      if (type === 'file') {
        const dbContent = await fs.readFile(FILES_DB, "utf-8");
        const dbData = JSON.parse(dbContent);
        
        // Find if file already exists to update it
        const existingIndex = dbData.findIndex((f: any) => f.id === file.id || f.filename === file.filename);
        if (existingIndex >= 0) {
            dbData[existingIndex] = { ...dbData[existingIndex], ...file, updatedAt: new Date().toISOString() };
        } else {
            dbData.push({ 
                ...file, 
                id: file.id || Date.now().toString(),
                uploadedAt: new Date().toISOString() 
            });
        }
        
        await fs.writeFile(FILES_DB, JSON.stringify(dbData, null, 2));
        console.log(`>>> [LOCAL DB] File saved: ${file.filename}`);
        return res.json({ success: true });
      }
      res.status(400).json({ error: "Invalid sync type" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/admin/files/:id", async (req, res) => {
    const { secret } = req.query;
    const cleanSecret = String(secret || "").trim();
    if (cleanSecret !== "1068575628") return res.status(403).json({ error: "Unauthorized" });

    try {
      const dbData = JSON.parse(await fs.readFile(FILES_DB, "utf-8"));
      const fileToDelete = dbData.find((f: any) => f.id === req.params.id);
      
      // Delete physical file if it exists
      if (fileToDelete && fileToDelete.localPath) {
        try {
          await fs.unlink(fileToDelete.localPath);
          console.log(`>>> [LOCAL DB] Physical file deleted: ${fileToDelete.localPath}`);
        } catch (err) {
          console.warn(`>>> [LOCAL DB] Could not delete physical file: ${fileToDelete.localPath}`, err);
        }
      }

      const filtered = dbData.filter((f: any) => f.id !== req.params.id);
      await fs.writeFile(FILES_DB, JSON.stringify(filtered, null, 2));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Delete failed" });
    }
  });

  // --- LOCAL FEEDBACK API ---
  app.post("/api/feedback", async (req, res) => {
    try {
      const dbData = JSON.parse(await fs.readFile(FEEDBACK_DB, "utf-8"));
      dbData.push({ ...req.body, id: Date.now().toString(), createdAt: new Date().toISOString() });
      await fs.writeFile(FEEDBACK_DB, JSON.stringify(dbData, null, 2));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Feedback failed" });
    }
  });

  app.delete("/api/admin/feedback/:id", async (req, res) => {
    const { secret } = req.query;
    const cleanSecret = String(secret || "").trim();
    if (cleanSecret !== "1068575628") return res.status(403).json({ error: "Unauthorized" });

    try {
      const dbData = JSON.parse(await fs.readFile(FEEDBACK_DB, "utf-8"));
      const filtered = dbData.filter((f: any) => f.id !== req.params.id);
      await fs.writeFile(FEEDBACK_DB, JSON.stringify(filtered, null, 2));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Delete failed" });
    }
  });

  app.get("/api/admin/feedback", async (req, res) => {
    const { secret } = req.query;
    const cleanSecret = String(secret || "").trim();
    if (cleanSecret !== "1068575628") return res.status(403).json({ error: "Unauthorized" });
    const data = await fs.readFile(FEEDBACK_DB, "utf-8");
    res.json(JSON.parse(data));
  });

  // --- APP SERVING ---
  if (!isProd) {
    console.log(">>> [SERVER] Mode: DEVELOPMENT (Vite Middleware)");
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    console.log(`>>> [SERVER] Mode: PRODUCTION (Static Serving)`);
    console.log(`>>> [SERVER] Serving assets from: ${distPath}`);
    
    app.use(express.static(distPath, {
        index: false // We handle index.html manually to ensure SPA fallback
    }));
    
    app.get("*all", (req, res) => {
        // Don't serve index.html for missing assets to avoid SyntaxError in browser
        if (req.path.startsWith('/assets/') || req.path.includes('.')) {
            return res.status(404).send('Not found');
        }
        res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // --- ERROR HANDLING & 404 ---
  
  // Custom 404 for API routes
  app.use("/api/*all", (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
  });

  // Global Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(">>> [SERVER ERROR]:", err);
    res.status(err.status || 500).json({ 
      error: err.message || "Internal Server Error",
      stack: isProd ? undefined : err.stack 
    });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`>>> [SERVER] SUCCESS: Local DB Mode running at http://localhost:${PORT}`);
  });
}

startServer();
