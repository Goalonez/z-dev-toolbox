import type { ToolExecutionError, Locale } from "@z-dev-toolbox/shared";

export const commonPanelCopy: Record<
  Locale,
  {
    clear: string;
    copy: string;
    copied: string;
    copyFailed: string;
    run: string;
    resultTitle: string;
    resultHint: string;
    resultPlaceholder: string;
  }
> = {
  "zh-CN": {
    clear: "重置",
    copy: "复制结果",
    copied: "结果已复制",
    copyFailed: "复制失败",
    run: "开始处理",
    resultTitle: "结果",
    resultHint: "处理结果显示于此，支持直接复制或继续使用。",
    resultPlaceholder: ""
  },
  "en-US": {
    clear: "Reset",
    copy: "Copy result",
    copied: "Copied",
    copyFailed: "Copy failed",
    run: "Run",
    resultTitle: "Result",
    resultHint: "Results appear here and can be copied or reused directly.",
    resultPlaceholder: ""
  }
};

export const formatToolError = (
  error: ToolExecutionError,
  messages: Record<string, string> = {},
) => {
  const base = messages[error.code] ?? error.message ?? error.code;

  return error.details ? `${base}: ${error.details}` : base;
};
