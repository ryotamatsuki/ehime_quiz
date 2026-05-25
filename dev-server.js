"use strict";

const fs = require("fs");
const http = require("http");
const path = require("path");

const port = Number(process.argv[2] || process.env.PORT || 8000);
const host = "127.0.0.1";
const root = process.cwd();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png"
};

const server = http.createServer((request, response) => {
  const requestPath = decodeURIComponent(new URL(request.url, `http://${host}`).pathname);
  const normalizedPath = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.normalize(path.join(root, normalizedPath));

  if (!filePath.startsWith(root)) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("not found");
      return;
    }

    response.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream" });
    response.end(data);
  });
});

server.listen(port, host, () => {
  console.log(`Ehime Quiz is available at http://${host}:${port}/`);
});
