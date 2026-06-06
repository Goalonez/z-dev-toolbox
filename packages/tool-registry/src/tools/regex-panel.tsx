import { useEffect, useRef, useState } from "react";

import { evaluateRegex, type RegexOutput } from "@z-dev-toolbox/core";
import type { Locale } from "@z-dev-toolbox/shared";
import { Button, Input, Textarea } from "@z-dev-toolbox/ui";

import {
  ToolActionDock,
  ToolCodeBlock,
  ToolFieldLabel,
  ToolGrid,
  ToolPane,
  ToolSelect
} from "../components/tool-panel-kit";
import { useToolDraftState } from "../components/use-tool-draft-state";
import { useToolFeedback } from "../components/use-tool-feedback";
import type { ToolPanelProps } from "../types";
import { commonPanelCopy, formatToolError } from "./panel-copy";

const TOOL_DRAFT_KEY = "tool:regex.playground:draft:v2";
const AUTO_RUN_DELAY_MS = 350;

const regexPresetOptions = [
  {
    value: "custom",
    labels: {
      "zh-CN": "自定义表达式",
      "en-US": "Custom"
    }
  },
  {
    value: "email",
    pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$",
    flags: "",
    replacement: "$&",
    labels: {
      "zh-CN": "邮箱地址",
      "en-US": "Email"
    }
  },
  {
    value: "url",
    pattern: "https?:\\/\\/[^\\s]+",
    flags: "g",
    replacement: "[$&]",
    labels: {
      "zh-CN": "URL 链接",
      "en-US": "URL"
    }
  },
  {
    value: "ipv4",
    pattern:
      "\\b(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)){3}\\b",
    flags: "g",
    replacement: "[$&]",
    labels: {
      "zh-CN": "IPv4 地址",
      "en-US": "IPv4"
    }
  },
  {
    value: "mobile-cn",
    pattern: "\\b1[3-9]\\d{9}\\b",
    flags: "g",
    replacement: "[$&]",
    labels: {
      "zh-CN": "中国手机号",
      "en-US": "CN mobile"
    }
  },
  {
    value: "hex-color",
    pattern: "#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\\b",
    flags: "g",
    replacement: "[$&]",
    labels: {
      "zh-CN": "十六进制颜色",
      "en-US": "Hex color"
    }
  },
  {
    value: "date",
    pattern: "\\b\\d{4}-\\d{2}-\\d{2}\\b",
    flags: "g",
    replacement: "[$&]",
    labels: {
      "zh-CN": "日期 YYYY-MM-DD",
      "en-US": "Date"
    }
  }
] as const;

const flagOptions = [
  {
    value: "",
    label: {
      "zh-CN": "无 flags",
      "en-US": "No flags"
    }
  },
  {
    value: "g",
    label: {
      "zh-CN": "g 全局匹配",
      "en-US": "g Global"
    }
  },
  {
    value: "i",
    label: {
      "zh-CN": "i 忽略大小写",
      "en-US": "i Ignore case"
    }
  },
  {
    value: "m",
    label: {
      "zh-CN": "m 多行模式",
      "en-US": "m Multiline"
    }
  },
  {
    value: "gi",
    label: {
      "zh-CN": "gi 全局 + 忽略大小写",
      "en-US": "gi Global + ignore case"
    }
  },
  {
    value: "gm",
    label: {
      "zh-CN": "gm 全局 + 多行",
      "en-US": "gm Global + multiline"
    }
  },
  {
    value: "gim",
    label: {
      "zh-CN": "gim 全局 + 忽略大小写 + 多行",
      "en-US": "gim Global + ignore case + multiline"
    }
  },
  {
    value: "gs",
    label: {
      "zh-CN": "gs 全局 + 跨行匹配",
      "en-US": "gs Global + dotAll"
    }
  },
  {
    value: "gu",
    label: {
      "zh-CN": "gu 全局 + Unicode",
      "en-US": "gu Global + Unicode"
    }
  }
] as const;

const panelCopy: Record<
  Locale,
  {
    inputTitle: string;
    inputHint: string;
    patternLabel: string;
    patternPlaceholder: string;
    presetLabel: string;
    flagsLabel: string;
    replacementLabel: string;
    replacementPlaceholder: string;
    sourceLabel: string;
    sourcePlaceholder: string;
    runAction: string;
    resultHint: string;
    errorMessage: Record<string, string>;
  }
> = {
  "zh-CN": {
    inputTitle: "正则表达式",
    inputHint: "输入表达式、替换模板和测试文本，执行后查看匹配与替换结果。",
    patternLabel: "表达式",
    patternPlaceholder: "请输入正则表达式",
    presetLabel: "常用",
    flagsLabel: "匹配选项",
    replacementLabel: "替换模板",
    replacementPlaceholder: "请输入替换模板，例如 [$&]",
    sourceLabel: "测试文本",
    sourcePlaceholder: "请输入需要匹配的测试文本",
    runAction: "执行",
    resultHint: "此处显示匹配数量、命中内容和替换结果。",
    errorMessage: {
      INVALID_INPUT: "输入参数无效",
      REGEX_FAILED: "正则表达式执行失败"
    }
  },
  "en-US": {
    inputTitle: "Regex",
    inputHint: "Enter a pattern, replacement template, and test text to inspect matching and replacement results.",
    patternLabel: "Pattern",
    patternPlaceholder: "Enter a regular expression",
    presetLabel: "Common",
    flagsLabel: "Flags",
    replacementLabel: "Replacement",
    replacementPlaceholder: "Enter a replacement template, for example [$&]",
    sourceLabel: "Source",
    sourcePlaceholder: "Enter the text to test",
    runAction: "Run",
    resultHint: "Match count, hits, and replacement output appear here.",
    errorMessage: {
      INVALID_INPUT: "Invalid input",
      REGEX_FAILED: "Regex execution failed"
    }
  }
};

const stringifyRegexResult = (result: RegexOutput, locale: Locale) =>
  [
    `${locale === "zh-CN" ? "匹配数量" : "Matches"}: ${result.matchCount}`,
    ...result.matches.map((item, index) =>
      `#${index + 1} @${item.index}: ${item.value}${
        item.groups.length ? ` | ${locale === "zh-CN" ? "分组" : "groups"} ${item.groups.join(", ")}` : ""
      }`,
    ),
    "",
    `${locale === "zh-CN" ? "替换结果" : "Replacement"}:`,
    result.replaced
  ].join("\n");

export const RegexPanel = ({
  autoCopyOnSuccess,
  bridge,
  locale,
  notify,
  storage
}: ToolPanelProps) => {
  const text = panelCopy[locale];
  const common = commonPanelCopy[locale];
  const [draft, setDraft] = useToolDraftState(storage, TOOL_DRAFT_KEY, {
    pattern: "",
    flags: "",
    replacement: "",
    source: "",
    preset: "custom"
  });
  const [result, setResult] = useState<RegexOutput | null>(null);
  const { feedback, setFeedback, copyText, reportSuccess } = useToolFeedback({
    autoCopyOnSuccess,
    bridge,
    copiedText: common.copied,
    copyFailedText: common.copyFailed,
    notify
  });
  const autoRunTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(
    null,
  );

  const clearAutoRunTimeout = () => {
    if (autoRunTimeoutRef.current) {
      window.clearTimeout(autoRunTimeoutRef.current);
      autoRunTimeoutRef.current = null;
    }
  };

  useEffect(
    () => () => {
      clearAutoRunTimeout();
    },
    [],
  );

  const runRegex = (input = draft) => {
    const nextResult = evaluateRegex(input);

    if (!nextResult.ok) {
      setResult(null);
      setFeedback({
        tone: "error",
        text: formatToolError(nextResult.error, text.errorMessage)
      });
      return;
    }

    setResult(nextResult.data);
    reportSuccess(
      locale === "zh-CN" ? "正则已执行" : "Executed",
      stringifyRegexResult(nextResult.data, locale),
    );
  };

  const scheduleRegex = (input: typeof draft) => {
    clearAutoRunTimeout();

    if (input.pattern.length === 0 || input.source.length === 0) {
      setResult(null);
      setFeedback(null);
      return;
    }

    autoRunTimeoutRef.current = window.setTimeout(() => {
      runRegex(input);
    }, AUTO_RUN_DELAY_MS);
  };

  const updateDraft = (value: Partial<typeof draft>) => {
    const nextDraft = {
      ...draft,
      ...value
    };

    setResult(null);
    setFeedback(null);
    setDraft(nextDraft);
    scheduleRegex(nextDraft);
  };

  return (
    <ToolGrid docked>
      <ToolPane title={text.inputTitle}>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_168px]">
          <div className="space-y-2">
            <ToolFieldLabel>{text.patternLabel}</ToolFieldLabel>
            <Input
              className="h-10 font-mono text-[13px]"
              placeholder={text.patternPlaceholder}
              spellCheck={false}
              value={draft.pattern}
              onChange={(event) => {
                updateDraft({
                  pattern: event.currentTarget.value,
                  preset: "custom"
                });
              }}
            />
          </div>
          <div className="space-y-2">
            <ToolFieldLabel>{text.presetLabel}</ToolFieldLabel>
            <ToolSelect
              className="h-10 w-full text-xs"
              value={draft.preset}
              onValueChange={(value) => {
                const preset = regexPresetOptions.find((item) => item.value === value);

                if (!preset || preset.value === "custom") {
                  updateDraft({ preset: value });
                  return;
                }

                updateDraft({
                  preset: value,
                  pattern: preset.pattern,
                  flags: preset.flags,
                  replacement: preset.replacement
                });
              }}
            >
              {regexPresetOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.labels[locale]}
                </option>
              ))}
            </ToolSelect>
          </div>
        </div>
        <div className="space-y-2">
          <ToolFieldLabel>{text.replacementLabel}</ToolFieldLabel>
          <Input
            className="h-10 font-mono text-[13px]"
            placeholder={text.replacementPlaceholder}
            spellCheck={false}
            value={draft.replacement}
            onChange={(event) => {
              updateDraft({ replacement: event.currentTarget.value });
            }}
          />
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <ToolFieldLabel>{text.sourceLabel}</ToolFieldLabel>
          <Textarea
            className="min-h-[18rem] max-h-[60dvh] flex-1 resize-none font-mono text-[13px] leading-6 xl:min-h-0 xl:max-h-none"
            placeholder={text.sourcePlaceholder}
            spellCheck={false}
            value={draft.source}
            onChange={(event) => {
              updateDraft({ source: event.currentTarget.value });
            }}
          />
        </div>
      </ToolPane>

      <ToolPane hideHeader>
        <ToolCodeBlock
          placeholder={common.resultPlaceholder}
          value={result ? stringifyRegexResult(result, locale) : ""}
        />
      </ToolPane>

      <ToolActionDock
        feedback={feedback}
        leftActions={
          <>
            <div className="min-w-0">
              <ToolSelect
                aria-label={text.flagsLabel}
                className="h-9 w-[8.75rem] max-w-full px-3 text-xs sm:w-[10rem] xl:w-[11rem]"
                panelMaxWidth={240}
                value={draft.flags}
                onValueChange={(value) => {
                  updateDraft({ flags: value });
                }}
              >
                {flagOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label[locale]}
                  </option>
                ))}
              </ToolSelect>
            </div>
            <Button
              data-tool-primary-action="true"
              size="sm"
              onClick={() => {
                clearAutoRunTimeout();
                runRegex();
              }}
            >
              {text.runAction}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft({
                  pattern: "",
                  flags: "",
                  replacement: "",
                  source: "",
                  preset: "custom"
                });
                setResult(null);
                setFeedback(null);
              }}
            >
              {common.clear}
            </Button>
          </>
        }
        rightActions={
          <>
            <Button
              disabled={!result}
              size="sm"
              variant="secondary"
              onClick={() => {
                if (result) {
                  void copyText(stringifyRegexResult(result, locale));
                }
              }}
            >
              {common.copy}
            </Button>
          </>
        }
      />
    </ToolGrid>
  );
};
