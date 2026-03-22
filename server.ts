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
  
  const ffmpegPath = fs.existsSync("/usr/bin/ffmpeg") ? "/usr/bin/ffmpeg" : ffmpegInstaller.path;
  const ffprobeInstaller = require("@ffprobe-installer/ffprobe");
  const ffprobePath = fs.existsSync("/usr/bin/ffprobe") ? "/usr/bin/ffprobe" : ffprobeInstaller.path;
  
  console.log(`Using ffmpeg from: ${ffmpegPath}`);
  console.log(`Using ffprobe from: ${ffprobePath}`);

  // Set environment variables for Remotion to find ffmpeg/ffprobe
  process.env.REMOTION_FFMPEG_PATH = ffmpegPath;
  process.env.REMOTION_FFPROBE_PATH = ffprobePath;

  // Clear cached videos on start to ensure new duration is applied
  try {
    const publicDir = path.join(process.cwd(), "public");
    if (fs.existsSync(publicDir)) {
      const files = fs.readdirSync(publicDir);
      for (const file of files) {
        if (file.endsWith(".mp4")) {
          fs.unlinkSync(path.join(publicDir, file));
        }
      }
      console.log("Cleared cached videos.");
    }
  } catch (err) {
    console.error("Error clearing cache:", err);
  }

  // Pre-bundle Remotion on start
  const bundleLocation = path.join(process.cwd(), "build");
  try {
    console.log("Pre-bundling Remotion project...");
    // Ensure build is clean
    if (fs.existsSync(bundleLocation)) {
      fs.rmSync(bundleLocation, { recursive: true, force: true });
    }
    // npx remotion bundle defaults to 'build'
    await execAsync(`npx remotion bundle src/remotion/index.tsx build --public-dir=public`);
    console.log("Remotion bundled successfully at " + bundleLocation);
  } catch (bundleErr) {
    console.error("Error pre-bundling Remotion:", bundleErr);
    // Don't crash the server, but log it
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
      const bundleLocation = path.join(process.cwd(), "build");
      
      // Ensure bundle exists
      if (!fs.existsSync(bundleLocation)) {
        console.log("Bundle missing, creating now...");
        await execAsync(`npx remotion bundle src/remotion/index.tsx build --public-dir=public`);
      }

      const outputDir = path.join(process.cwd(), "public");
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const safeStudentName = studentName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const outputLocation = path.join(outputDir, `${safeStudentName}_birthday.mp4`);
      
      // Check if video already exists (cache)
      if (fs.existsSync(outputLocation)) {
        console.log(`Serving cached video for ${studentName}`);
        return res.download(outputLocation, `${safeStudentName}_Birthday.mp4`);
      }

      console.log(`Starting render for ${studentName}...`);
      
      // Get audio duration using ffprobe
      let durationInFrames = 30 * 24; // Default 30s
      try {
        const audioPath = path.join(process.cwd(), "public", "birthday.mp3");
        if (fs.existsSync(audioPath)) {
          const ffprobeCmd = `"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`;
          const { stdout } = await execAsync(ffprobeCmd);
          const duration = parseFloat(stdout);
          if (!isNaN(duration)) {
            durationInFrames = Math.ceil(duration * 24);
            console.log(`Calculated duration from ffprobe: ${duration}s (${durationInFrames} frames)`);
          }
        }
      } catch (durationErr) {
        console.error("Error getting duration with ffprobe:", durationErr);
      }

      try {
        // Use npx remotion render with optimized settings
        const props = JSON.stringify({ studentName, durationInFrames });
        const renderCommand = `npx remotion render "${bundleLocation}" BirthdayVideo "${outputLocation}" --props='${props}' --browser-flags="--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage" --concurrency=4 --quiet --ffmpeg-executable="${ffmpegPath}" --ffprobe-executable="${ffprobePath}" --public-dir=public`;
        
        console.log(`Executing: ${renderCommand}`);
        await execAsync(renderCommand);
        console.log(`Render complete: ${outputLocation}`);
      } catch (renderErr) {
        console.error("Error during npx remotion render:", renderErr);
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
        // Cache is enabled, we don't delete the file here.
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
