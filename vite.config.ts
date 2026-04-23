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

// Middleware to handle contact form submissions
function contactEmailMiddleware() {
  return {
    name: "contact-email-api",
    configResolved() {},
    async configureServer(server: any) {
      return () => {
        server.middlewares.use("/api/send-contact-email", async (req: any, res: any) => {
          if (req.method !== "POST") {
            res.writeHead(405, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Method not allowed" }));
            return;
          }

          let body = "";
          req.on("data", (chunk: any) => {
            body += chunk.toString();
          });

          req.on("end", async () => {
            try {
              const formData = JSON.parse(body);
              const { name, email, subject, message } = formData;

              if (!name || !email || !subject || !message) {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Missing required fields" }));
                return;
              }

              const resendApiKey = process.env.RESEND_KEY;

              if (!resendApiKey) {
                console.error("RESEND_KEY not configured");
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Email service not configured" }));
                return;
              }

              const response = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${resendApiKey}`,
                },
                body: JSON.stringify({
                  from: "contact@cornerstonedigitalsports.com",
                  to: "contact@cornerstonedigitalsports.com",
                  reply_to: email,
                  subject: `New Contact Form Submission: ${subject}`,
                  html: `
                    <h2>New Contact Form Submission</h2>
                    <p><strong>Name:</strong> ${name}</p>
                    <p><strong>Email:</strong> ${email}</p>
                    <p><strong>Subject:</strong> ${subject}</p>
                    <h3>Message:</h3>
                    <p>${message.replace(/\n/g, "<br>")}</p>
                  `,
                }),
              });

              if (!response.ok) {
                const error = await response.text();
                console.error("Resend API error:", error);
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Failed to send email" }));
                return;
              }

              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ success: true }));
            } catch (error) {
              console.error("Error processing contact form:", error);
              res.writeHead(500, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Internal server error" }));
            }
          });
        });
      };
    },
  };
}

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
    minify: "terser",
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
  plugins: [react(), contactEmailMiddleware()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
}));
