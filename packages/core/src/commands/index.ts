/** Frozen command IDs — must match v6.0.2 shortcut bindings in GM storage. */
export const SHORTCUT_COMMANDS = [
  {
    id: "toggle-panel",
    label: "召唤 / 隐藏面板",
    defaultChord: "Ctrl+KeyB",
  },
  {
    id: "open-processed",
    label: "AI 处理字幕",
    defaultChord: "Ctrl+Alt+Digit1",
  },
  {
    id: "open-postprocess",
    label: "后处理结果",
    defaultChord: "Ctrl+Alt+Digit2",
  },
  {
    id: "toggle-dock",
    label: "悬浮 / 靠边",
    defaultChord: "Ctrl+Alt+KeyD",
  },
] as const;

export type ShortcutCommandId = (typeof SHORTCUT_COMMANDS)[number]["id"];
