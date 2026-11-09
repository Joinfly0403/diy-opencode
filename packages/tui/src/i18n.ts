export * as I18n from "./i18n.js"

/**
 * 本地化：语言来自 COGAGENT_LANG > LC_ALL > LANG，zh* 视为中文，其余英文。
 * 两种写法：
 *   t("English")               语义化词典（命令标题用这个）
 *   L({ zh: "中文", en: "English" })  调用点内联双语（新文案优先用这个）
 */
const raw = process.env.COGAGENT_LANG ?? process.env.LC_ALL ?? process.env.LANG ?? ""
export const language = /^zh/i.test(raw) ? "zh" : "en"

const zh: Record<string, string> = {
    "MCP server needs authentication": "MCP 服务需要认证",
    "Show command palette": "打开命令面板",
    "Switch session": "切换会话",
    "New session": "新建会话",
    "Clear session": "清空会话",
    "Open session or project": "打开会话或项目",
    "Next tab": "下一个标签",
    "Previous tab": "上一个标签",
    "Next unread tab": "下一个未读标签",
    "Previous unread tab": "上一个未读标签",
    "Close tab": "关闭标签",
    "Reopen closed tab": "恢复关闭的标签",
    "Switch model": "切换模型",
    "Model cycle": "循环切换模型",
    "Model cycle reverse": "反向循环切换模型",
    "Favorite cycle": "循环切换收藏模型",
    "Favorite cycle reverse": "反向循环切换收藏模型",
    "Switch agent": "切换 Agent",
    "View usage": "查看用量",
    "MCP servers": "MCP 服务",
    "Agent cycle": "循环切换 Agent",
    "Variant cycle": "循环切换变体",
    "Switch model variant": "切换模型变体",
    "No variants available": "无可用变体",
    "Agent cycle reverse": "反向循环切换 Agent",
    "Connect an integration": "连接集成",
    "Show release highlights": "查看版本亮点",
    "Open settings": "打开设置",
    "View status": "查看状态",
    "Pair device": "配对设备",
    "Restart service": "重启服务",
    "Reload configuration": "重新加载配置",
    "View debug info": "查看调试信息",
    "Switch theme": "切换主题",
    "Help": "帮助",
    "Open docs": "打开文档",
    "Exit the app": "退出应用",
    "Toggle debug panel": "显示/隐藏调试面板",
    "Toggle console": "显示/隐藏控制台",
    "Suspend terminal": "挂起终端",
  "Copied to clipboard": "已复制到剪贴板",
  "Debug info copied to clipboard": "调试信息已复制到剪贴板",
  "Restarting service…": "正在重启服务…",
  "Service restarted": "服务已重启",
  "Reloading configuration…": "正在重新加载配置…",
  "Configuration reloaded": "配置已重新加载",
  "Run /mcps to view details.": "运行 /mcps 查看详情。",
  "The current model does not support any variants.": "当前模型不支持任何变体。",
  "No sessions found": "未找到会话",
  "No sessions available": "暂无会话",
  "Allow once": "允许一次",
  "Always allow": "始终允许",
  "Reject": "拒绝",
  "Getting started": "开始使用",
  "Could not open the browser. Copy the URL and continue manually.": "无法打开浏览器，请复制链接手动继续。"
  }

export function t(text: string): string {
  if (language !== "zh") return text
  return zh[text] ?? text
}

export function L(entry: { zh: string; en: string }): string {
  return language === "zh" ? entry.zh : entry.en
}
