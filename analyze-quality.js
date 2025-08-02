import { convertRaw, OutputFormat } from "coreimage-raw-convert";
import { AprilTag } from "@monumental-works/apriltag-node";
import sharp from "sharp";
import fs from "fs/promises";
import path from "path";
import os from "os";
import dotenv from "dotenv";

// Load environment variables from .env.local if it exists
try {
  const envPath = path.join(process.cwd(), '.env.local');
  await fs.access(envPath);
  dotenv.config({ path: envPath });
} catch {
  // .env.local doesn't exist, that's okay
}

const QUALITY_VALUES = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];

// Parse command line arguments
const args = process.argv.slice(2);
const nonFlagArgs = args.filter(arg => !arg.startsWith('-'));
const subsetSize = nonFlagArgs.length > 0 && !isNaN(parseInt(nonFlagArgs[0])) ? parseInt(nonFlagArgs[0]) : null;
const rawDir = nonFlagArgs.length > 1 ? nonFlagArgs[1] : (process.env.RAW_DIR || null);
const preserveFiles = args.includes("--preserve") || args.includes("-p");
const printCorners = args.includes("--corners") || args.includes("-c");

if (!rawDir) {
  console.error("Error: No RAW directory specified.");
  console.error("Please provide a directory path as the second argument or set RAW_DIR in .env.local");
  process.exit(1);
}

async function createTempDir() {
  const tempDir = path.join(os.tmpdir(), `apriltag-quality-${Date.now()}`);
  await fs.mkdir(tempDir, { recursive: true });
  return tempDir;
}

async function convertARWToPNG(arwPath, outputPath) {
  const rawBuffer = await fs.readFile(arwPath);
  const pngBuffer = convertRaw(rawBuffer, OutputFormat.PNG);
  await fs.writeFile(outputPath, pngBuffer);
}

async function convertARWToJPEG(arwPath, outputPath, quality) {
  const rawBuffer = await fs.readFile(arwPath);
  const jpegBuffer = convertRaw(rawBuffer, OutputFormat.JPEG, {
    quality: quality,
  });
  await fs.writeFile(outputPath, jpegBuffer);
}

// Create detector once to avoid re-initialization
const detector = new AprilTag("tagStandard52h13", {
  quadDecimate: 1.0,
  quadSigma: 0.0,
  refineEdges: true,
  decodeSharpening: 0.25,
  numThreads: 4,
});

async function detectAprilTags(imagePath) {
  // Load image with sharp and convert to grayscale raw data
  const image = await sharp(imagePath)
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { data, info } = image;

  const detections = detector.detect(info.width, info.height, data);
  return detections.map((detection) => ({
    id: detection.id,
    corners: detection.corners,
  }));
}

function calculateCornerDistance(corner1, corner2) {
  const dx = corner1[0] - corner2[0];
  const dy = corner1[1] - corner2[1];
  return Math.sqrt(dx * dx + dy * dy);
}

function calculateDeltas(groundTruth, detection) {
  const deltas = [];

  for (const gtTag of groundTruth) {
    const detTag = detection.find((d) => d.id === gtTag.id);
    if (detTag) {
      for (let i = 0; i < 4; i++) {
        const delta = calculateCornerDistance(
          gtTag.corners[i],
          detTag.corners[i]
        );
        deltas.push(delta);
      }
    }
  }

  return deltas;
}

function calculateStats(deltas) {
  if (deltas.length === 0) {
    return { min: 0, mean: 0, median: 0, max: 0 };
  }

  const sorted = deltas.sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const mean = deltas.reduce((sum, val) => sum + val, 0) / deltas.length;
  const median =
    sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];

  return { min, mean, median, max };
}

async function main() {
  console.log("AprilTag Quality Analysis");
  console.log("Usage: node analyze-quality.js [subset_size] [raw_directory] [options]");
  console.log("Arguments:");
  console.log("  subset_size     Number of images to process (default: all)");
  console.log("  raw_directory   Path to directory containing ARW files (default: from .env.local)");
  console.log("Options:");
  console.log("  --preserve,-p   Keep converted files and print paths");
  console.log("  --corners,-c    Print corner positions ordered by marker ID");
  console.log("Example: node analyze-quality.js 10 /path/to/raw --preserve\n");

  try {
    const tempDir = await createTempDir();
    console.log(`Using temp directory: ${tempDir}`);

    let arwFiles = (await fs.readdir(rawDir)).filter((file) =>
      file.toLowerCase().endsWith(".arw")
    );

    console.log(`Found ${arwFiles.length} ARW files`);

    // Apply subset if specified
    if (subsetSize && subsetSize > 0 && subsetSize < arwFiles.length) {
      arwFiles = arwFiles.slice(0, subsetSize);
      console.log(`Using subset of ${subsetSize} files`);
    }

    const results = [];

    for (const quality of QUALITY_VALUES) {
      console.log(`\nProcessing quality: ${quality}`);
      const allDeltas = [];
      let totalMissingMarkers = 0;

      for (const arwFile of arwFiles) {
        const arwPath = path.join(rawDir, arwFile);
        const baseName = path.basename(arwFile, ".ARW");

        // Convert to PNG (ground truth)
        const pngPath = path.join(tempDir, `${baseName}_gt.png`);
        await convertARWToPNG(arwPath, pngPath);
        if (preserveFiles && quality === QUALITY_VALUES[0]) {
          console.log(`  PNG: ${pngPath}`);
        }
        const groundTruth = await detectAprilTags(pngPath);
        console.log(
          `  ${arwFile}: ${groundTruth.length} markers detected (ground truth)`
        );

        if (printCorners && quality === QUALITY_VALUES[0]) {
          console.log(`\n  Ground truth corners for ${arwFile}:`);
          const sortedGT = [...groundTruth].sort((a, b) => a.id - b.id);
          for (const tag of sortedGT) {
            console.log(
              `    Tag ${tag.id}: ${tag.corners
                .map((c) => `(${c[0].toFixed(2)}, ${c[1].toFixed(2)})`)
                .join(", ")}`
            );
          }
        }

        // Convert to JPEG with specific quality
        const jpegPath = path.join(tempDir, `${baseName}_q${quality}.jpg`);
        await convertARWToJPEG(arwPath, jpegPath, quality);
        if (preserveFiles) {
          console.log(`  JPEG (q=${quality}): ${jpegPath}`);
        }
        const detection = await detectAprilTags(jpegPath);
        console.log(
          `  ${arwFile}: ${detection.length} markers detected (JPEG q=${quality})`
        );

        // Count missing markers
        const detectedIds = new Set(detection.map((d) => d.id));
        const missingMarkers = groundTruth.filter(
          (gt) => !detectedIds.has(gt.id)
        ).length;
        totalMissingMarkers += missingMarkers;

        if (printCorners) {
          console.log(`\n  JPEG (q=${quality}) corners for ${arwFile}:`);
          const sortedDet = [...detection].sort((a, b) => a.id - b.id);
          for (const tag of sortedDet) {
            console.log(
              `    Tag ${tag.id}: ${tag.corners
                .map((c) => `(${c[0].toFixed(2)}, ${c[1].toFixed(2)})`)
                .join(", ")}`
            );
          }
        }

        // Calculate deltas
        const deltas = calculateDeltas(groundTruth, detection);
        allDeltas.push(...deltas);

        // Clean up temporary files if not preserving
        if (!preserveFiles) {
          await fs.unlink(pngPath);
          await fs.unlink(jpegPath);
        }
      }

      const stats = calculateStats(allDeltas);
      results.push({
        quality,
        ...stats,
        missingMarkers: totalMissingMarkers,
      });
    }

    // Display results as table
    console.log("\n\nQuality Analysis Results:");
    console.log(
      "Quality | Min Delta | Mean Delta | Median Delta | Max Delta | Missing Markers"
    );
    console.log(
      "--------|-----------|------------|--------------|-----------|----------------"
    );

    for (const result of results) {
      console.log(
        `${result.quality.toFixed(2).padEnd(7)} | ` +
          `${result.min.toFixed(5).padEnd(9)} | ` +
          `${result.mean.toFixed(5).padEnd(10)} | ` +
          `${result.median.toFixed(5).padEnd(12)} | ` +
          `${result.max.toFixed(5).padEnd(9)} | ` +
          `${result.missingMarkers}`
      );
    }

    // Clean up temp directory if not preserving files
    if (!preserveFiles) {
      await fs.rmdir(tempDir);
    } else {
      console.log(`\nPreserved files in: ${tempDir}`);
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
