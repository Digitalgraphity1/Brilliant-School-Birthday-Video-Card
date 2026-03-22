import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import { parse } from "csv-parse/sync";
import * as renderer from "@remotion/renderer";
import fs from "fs";
import { createRequire } from "module";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const require = createRequire(import.meta.url);
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");

async function startServer() {
  console.log("Starting server...");
  const app = express();
  const PORT = 3000;
  
  const ffmpegPath = ffmpegInstaller.path;
  const ffprobeInstaller = require("@ffprobe-installer/ffprobe");
  const ffprobePath = ffprobeInstaller.path;
  
  // Set these globally so Remotion can find them
  process.env.FFMPEG_PATH = ffmpegPath;
  process.env.FFPROBE_PATH = ffprobePath;
  
  console.log(`Using ffmpeg from: ${ffmpegPath}`);
  console.log(`Using ffprobe from: ${ffprobePath}`);

  // Pre-bundle Remotion on start
  const bundleLocation = path.join(process.cwd(), "build");
  
  async function getBundle() {
    if (fs.existsSync(bundleLocation)) return bundleLocation;
    console.log("Bundling Remotion project...");
    try {
      await execAsync(`npx remotion bundle src/remotion/index.tsx`);
      return bundleLocation;
    } catch (e) {
      console.error("Failed to bundle:", e);
      throw e;
    }
  }

  try {
    await getBundle();
    console.log("Initial bundle created successfully.");
  } catch (bundleErr) {
    console.error("Error during initial bundle:", bundleErr);
  }

  // API routes
  app.get("/api/debug-files", (req, res) => {
    const publicFiles = fs.existsSync("public") ? fs.readdirSync("public") : [];
    const distRemotionFiles = fs.existsSync("dist-remotion") ? fs.readdirSync("dist-remotion") : [];
    res.json({
      public: publicFiles,
      distRemotion: distRemotionFiles,
      cwd: process.cwd(),
      env: process.env.NODE_ENV
    });
  });

  app.get("/api/debug-csv", async (req, res) => {
    try {
      const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ_rEXB4vZe8DalNlybVTUbtESHnU0loPJDlg26z07fIzA6JC7PzpqSruEWrheHJINWnJqlEIkv7rKq/pub?gid=0&single=true&output=csv";
      const response = await axios.get(url);
      fs.writeFileSync("debug_csv.txt", response.data.split('\n').slice(0, 10).join('\n'));
      res.send("CSV data written to debug_csv.txt");
    } catch (error) {
      res.status(500).send(String(error));
    }
  });

  app.get("/api/students", async (req, res) => {
    console.log("Fetching students from Google Sheets...");
    try {
      const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ_rEXB4vZe8DalNlybVTUbtESHnU0loPJDlg26z07fIzA6JC7PzpqSruEWrheHJINWnJqlEIkv7rKq/pub?gid=0&single=true&output=csv";
      const response = await axios.get(url);
      console.log("CSV data received.");
      const records = parse(response.data, {
        columns: true,
        skip_empty_lines: true,
        bom: true,
        trim: true,
      });
      console.log(`Parsed ${records.length} students.`);
      res.json(records);
    } catch (error) {
      console.error("Error fetching students:", error);
      res.status(500).json({ error: "Failed to fetch students", details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/render-video", express.json(), async (req, res) => {
    const { studentName } = req.body;
    console.log(`Received render request for student: ${studentName}`);

    if (!studentName) {
      return res.status(400).json({ error: "studentName is required" });
    }

    try {
      const currentBundle = await getBundle();
      const publicDir = path.join(process.cwd(), "public");
      
      const outputDir = path.join(process.cwd(), "public", "renders");
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const safeStudentName = studentName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const outputLocation = path.join(outputDir, `${safeStudentName}_birthday_${Date.now()}.mp4`);
      
      console.log(`Starting optimized render for ${studentName}...`);
      const startTime = Date.now();
      
      try {
        // Use @remotion/renderer API directly for better performance
        const compositions = await renderer.getCompositions(currentBundle, {
          inputProps: { studentName },
        });
        
        const composition = compositions.find((c) => c.id === "BirthdayVideo");
        if (!composition) {
          throw new Error("Composition BirthdayVideo not found");
        }

        console.log(`Rendering composition: ${composition.id} with duration: ${composition.durationInFrames} frames`);

        await renderer.renderMedia({
          composition,
          serveUrl: currentBundle,
          codec: "h264",
          outputLocation,
          inputProps: { studentName },
          concurrency: 1, // Prevent OOM on Railway
          imageFormat: "jpeg", // Save memory
          jpegQuality: 80,
          chromiumOptions: {
            args: [
              "--no-sandbox", 
              "--disable-setuid-sandbox", 
              "--disable-dev-shm-usage",
              "--disable-gpu",
              "--disable-software-rasterizer",
              "--no-zygote",
              "--single-process"
            ],
          } as any,
        });
        
        const endTime = Date.now();
        console.log(`Render complete in ${((endTime - startTime) / 1000).toFixed(2)}s: ${outputLocation}`);
      } catch (renderErr) {
        console.error("Error during @remotion/renderer renderMedia:", renderErr);
        throw new Error(`Rendering failed: ${renderErr instanceof Error ? renderErr.message : String(renderErr)}`);
      }

      if (!fs.existsSync(outputLocation)) {
        throw new Error(`Rendered file not found at ${outputLocation} after successful render call`);
      }

      console.log(`Sending file for download: ${outputLocation}`);
      res.download(outputLocation, `${safeStudentName}_Birthday.mp4`, (err) => {
        if (err) {
          console.error("Download error:", err);
          if (!res.headersSent) {
            res.status(500).send("Error downloading file");
          }
        }
        // डाउनलोड के बाद फाइल डिलीट कर दें ताकि सर्वर भर न जाए
        if (fs.existsSync(outputLocation)) {
          try {
            fs.unlinkSync(outputLocation);
            console.log(`Deleted temporary file: ${outputLocation}`);
          } catch (unlinkErr) {
            console.error("Error deleting file:", unlinkErr);
          }
        }
      });
    } catch (error) {
      console.error("Error in render-video endpoint:", error);
      if (!res.headersSent) {
        res.status(500).json({ 
          error: "Failed to render video", 
          details: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
      }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
