import { spawn } from "node:child_process";
const children = [
  spawn(process.execPath, ["backend/src/server.js"], { stdio: "inherit" }),
  spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "--config",
      "frontend/vite.config.js",
      "frontend",
    ],
    { stdio: "inherit" },
  ),
];
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    children.forEach((child) => child.kill());
    process.exit();
  });
