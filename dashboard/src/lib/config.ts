/**
 * 仪表盘/用量等：本地 localhost 一律用空字符串（相对路径走 CLI 内置 API）。
 * 纯本地部署没有远端形态；非 localhost 场景兜底指向本机默认端口。
 */
export function getBackendBaseUrl() {
  const isLocalhost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  return isLocalhost ? "" : "http://127.0.0.1:7680";
}
