import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import * as fs from "fs";

// Parse .env file directly
function loadEnv() {
  const envPath = path.resolve(__dirname, ".env");
  if (!fs.existsSync(envPath)) return {};

  const content = fs.readFileSync(envPath, "utf-8");
  const env: Record<string, string> = {};

  content.split("\n").forEach((line) => {
    if (line.trim() && !line.startsWith("#")) {
      const [key, ...valueParts] = line.split("=");
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join("=").trim();
      }
    }
  });

  return env;
}

const envVars = loadEnv();

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  optimizeDeps: {
    include: ["react/jsx-runtime"],
    esbuildOptions: {
      target: "esnext",
    },
  },
  server: {
    host: "::",
    port: 8080,
    fs: {
      allow: [
        path.resolve(__dirname),
        path.resolve(__dirname, "client"),
        path.resolve(__dirname, "shared"),
        path.resolve(__dirname, "node_modules"),
      ],
      deny: [".env.local", ".env.*.local", "*.{crt,pem}"],
    },
  },
  build: {
    outDir: "dist/spa",
    sourcemap: mode === "production" ? false : "inline",
    rollupOptions: {
      output: {
        sourcemapIgnoreList: () => true,
      },
    },
  },
  define: {
    "import.meta.env.SUPABASE_URL": JSON.stringify(
      process.env.SUPABASE_URL || "",
    ),
    "import.meta.env.SUPABASE_ANON_KEY": JSON.stringify(
      envVars.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "",
    ),
    "import.meta.env.VITE_MARKETPLACE_ADDRESS": JSON.stringify(
      envVars.VITE_MARKETPLACE_ADDRESS || process.env.VITE_MARKETPLACE_ADDRESS || "",
    ),
    "import.meta.env.VITE_ERC721_ADDRESS": JSON.stringify(
      envVars.VITE_ERC721_ADDRESS || process.env.VITE_ERC721_ADDRESS || "0x67B77d5C6Df7422b25e614C537135F3d42C644d0",
    ),
    "import.meta.env.VITE_ERC1155_ADDRESS": JSON.stringify(
      envVars.VITE_ERC1155_ADDRESS || process.env.VITE_ERC1155_ADDRESS || "",
    ),
    "import.meta.env.BANNED_USERNAMES": JSON.stringify(
      envVars.BANNED_USERNAMES || process.env.BANNED_USERNAMES || "",
    ),
    "import.meta.env.GOOGLE_ANALYTICS_TOKEN": JSON.stringify(
      process.env.GOOGLE_ANALYTICS_TOKEN || "",
    ),
    "import.meta.env.MIXPANEL_TOKEN": JSON.stringify(
      process.env.MIXPANEL_TOKEN || "",
    ),
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
}));
