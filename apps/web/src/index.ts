import { serve } from "bun";
import index from "./index.html";

// Static host for the React app. The API lives in apps/api/ (Express on
// port 8000) — this server only serves the bundle, no demo routes.
const server = serve({
  routes: {
    "/*": index,
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);
