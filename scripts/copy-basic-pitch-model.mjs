import { existsSync, mkdirSync, cpSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, "..");

const candidates = [
  resolve(root, "node_modules", "@spotify", "basic-pitch", "model"),
  resolve(root, "node_modules", "@spotify", "basic-pitch", "dist", "model")
];

const source = candidates.find((path) => existsSync(path));
const target = resolve(root, "public", "basic-pitch-model");

if (!source) {
  console.warn("[Basic Pitch] model folder was not found. Basic Pitch test may fail at runtime.");
  console.warn("[Basic Pitch] checked:");
  candidates.forEach((path) => console.warn(`- ${path}`));
  process.exit(0);
}

mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });

console.log(`[Basic Pitch] model copied to ${target}`);
