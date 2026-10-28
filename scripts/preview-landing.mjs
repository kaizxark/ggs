import { createServer } from "node:http";
import { addMobileNavActions, MOBILE_NAV_STYLES } from "./mobile-navigation.mjs";

const upstream = new URL("https://ggs-erp.vercel.app");
const port = Number(process.env.PORT ?? 3002);

const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405).end("Method not allowed");
    return;
  }

  try {
    const upstreamResponse = await fetch(new URL(request.url ?? "/", upstream), {
      method: request.method,
    });
    const headers = {};
    for (const name of ["content-type", "cache-control", "last-modified"]) {
      const value = upstreamResponse.headers.get(name);
      if (value) headers[name] = value;
    }

    let body = Buffer.alloc(0);
    if (request.method === "GET" && upstreamResponse.body) {
      const payload = Buffer.from(await upstreamResponse.arrayBuffer());
      if (headers["content-type"]?.includes("text/html")) {
        let html = addMobileNavActions(payload.toString("utf8"));
        const style = `<style>${MOBILE_NAV_STYLES}</style>`;
        if (!html.includes("</head>")) {
          throw new Error("The landing page has no closing head tag for mobile navigation styles.");
        }
        html = html.replace("</head>", `${style}</head>`);
        body = Buffer.from(html);
      } else {
        body = payload;
      }
      headers["content-length"] = String(body.byteLength);
    }

    response.writeHead(upstreamResponse.status, headers);
    response.end(body);
  } catch (error) {
    console.error("Could not load the landing page preview:", error);
    response.writeHead(502).end("Could not load the landing page preview.");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Landing page preview: http://localhost:${port}/`);
});
