export * as I18n from "./i18n.js"

/**
 * 轻量本地化（方案 B 的最小落地）：
 * - 语言来源：COGAGENT_LANG > LC_ALL > LANG，zh* 视为中文
 * - 词典按"英文原文"为 key，查不到就回落英文
 * - 覆盖范围：命令面板标题（用户最常看到的英文）
 */
const raw = process.env.COGAGENT_LANG ?? process.env.LC_ALL ?? process.env.LANG ?? ""
export const language = /^zh/i.test(raw) ? "zh" : "en"

const zh: Record<string, string> = {
  "Switch agent": "切换 Agent",
  "One-shot answer from the session": "不打断会话的临时问答",
  "Change working directory": "切换工作目录",
  "Clear session": "清空会话",
  "Compact session": "压缩会话",
  "Connect an integration": "连接集成",
  "Switch session": "切换会话",
  "Copy last assistant message": "复制上一条回答",
  "View debug info": "查看调试信息",
  "Open diff viewer": "打开差异视图",
  "View usage": "查看用量",
  "Model cycle": "切换模型",
  "Model cycle reverse": "反向切换模型",
  "Favorite cycle": "切换收藏模型",
  "Favorite cycle reverse": "反向切换收藏模型",
  "Toggle sidebar": "显示/隐藏侧栏",
  "Open external editor": "打开外部编辑器",
  "Exit the application": "退出应用",
  "Paste from clipboard": "从剪贴板粘贴",
  "Copy message": "复制消息",
  "Undo message": "撤销消息",
  "Redo message": "重做消息",
  "Submit prompt": "提交输入",
  "Queue prompt": "排队发送",
  "Clear input field": "清空输入框",
  "Open skill selector": "打开技能选择",
  "View image attachments": "查看图片附件",
}

export function t(text: string): string {
  if (language !== "zh") return text
  return zh[text] ?? text
}
