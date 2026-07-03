import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const seoRouteMap = {
  "/g": "/index.html",
  "/how-to-write-drum-notation": "/how-to-write-drum-notation.html",
  "/drum-notation-cheat-sheet": "/drum-notation-cheat-sheet.html",
  "/drum-groove-notation-examples": "/drum-groove-notation-examples.html",
};

const seoDevRewritePlugin = {
  name: "seo-dev-rewrites",
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      const url = req.url ? req.url.split("?")[0] : "";
      if (url.startsWith("/g/")) {
        req.url = "/index.html";
        next();
        return;
      }
      const rewritten = seoRouteMap[url];
      if (rewritten) req.url = rewritten;
      next();
    });
  },
};

const localApiDevPlugin = {
  name: "local-api-dev",
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const requestUrl = new URL(req.url || "/", "http://localhost");
      if (requestUrl.pathname !== "/api/admin-stats") {
        next();
        return;
      }

      try {
        const handlerModule = await import("./api/admin-stats.js");
        req.query = Object.fromEntries(requestUrl.searchParams.entries());
        res.status = (statusCode) => {
          res.statusCode = statusCode;
          return res;
        };
        res.json = (payload) => {
          if (!res.headersSent) res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify(payload));
        };
        await handlerModule.default(req, res);
      } catch (error) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ error: error?.message || "Local API error." }));
      }
    });
  },
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  Object.assign(process.env, env);
  return {
    plugins: [react(), localApiDevPlugin, seoDevRewritePlugin],
  };
});
