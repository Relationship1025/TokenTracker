# Token Tracker（个人专属版）

基于 [xiufengsun/TokenTracker](https://github.com/xiufengsun/TokenTracker) 的个人分支。已移除全部云端能力（InsForge 登录、云同步、排行榜、遥测、自动更新），改造为**纯本地、纯 Windows** 的个人 AI token 用量记录工具。数据只存在于本机 `~/.tokentracker/`，多机汇总用文件导出/导入完成。

## 功能

- **CLI**（`src/`，Node ≥20）：解析 40+ AI 编码工具的本地会话日志，按 30 分钟桶归一化 token 用量与成本；`tracker serve` 在 `:7680` 起本地服务。
- **仪表盘**（`dashboard/`，React 18 + Vite）：用量总览、热力图、模型/项目分解、会话分析、限额（Claude/Codex/OpenCode/Devin 等）、Skills 管理、IP 检查、服务商状态页、年度 Wrapped、桌面宠物与小组件。
- **主题**：经典明暗 + 自定义的「Token 便利店」（夜晚便利店 3D 场景，Blender 制作）。
- **Windows 托盘应用**（`TokenTrackerWin/`，.NET 8 WinForms + WPF + WebView2）：系统托盘、悬浮宠物、限额小组件、开机自启。
- **本地数据迁移**：Settings → 数据迁移，导出/导入 JSON 快照，在主力机上合并多台电脑的历史（sha256 校验、同源累积、可撤销）。

## 使用

```bash
npm install
npm run dashboard:build
node bin/tracker.js init        # 首次安装钩子与集成
node bin/tracker.js serve       # http://localhost:7680
```

Windows 桌面应用：

```bash
dotnet build TokenTrackerWin/TokenTrackerWin.csproj -c Release
```

## 开发与校验

```bash
npm test                        # node --test test/*.test.js
npm run ci:local                # 测试 + 文案/守卫校验 + 仪表盘构建
npm run dashboard:dev           # Vite 开发服务器（mock 模式，:5173）
```

## 数据与隐私

只记录 token 计数（输入/输出/缓存/推理）与模型名、会话计数——从不读取或保存提示词、回复内容。所有数据仅写入本机 `~/.tokentracker/`。导出的迁移快照同样只含 token 统计。

## 许可

MIT（见 [LICENSE](./LICENSE)）。上游项目版权归原作者所有，感谢 [xiufengsun/TokenTracker](https://github.com/xiufengsun/TokenTracker)。
