// Shim：让 raw-node ESM (e.g. node --test) 能通过 .js 后缀 import 到 .ts 源。
// Vite / tsc bundler-mode 自己就会解析 .js → .ts，shim 只为 raw node 测试存在。
export * from "./compass.ts";
