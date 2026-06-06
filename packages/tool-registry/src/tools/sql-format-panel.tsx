import { useEffect, useMemo, useRef, useState } from "react";

import {
  formatSql,
  sqlDialectOptions,
  sqlFormatInputSchema,
  type SqlDialect,
  type SqlFormatInput,
  type SqlFormatOutput,
} from "@z-dev-toolbox/core";
import type { Locale } from "@z-dev-toolbox/shared";
import { Button, Textarea, cn } from "@z-dev-toolbox/ui";

import {
  ToolActionDock,
  ToolCodeBlock,
  ToolGrid,
  ToolSelect,
  ToolPane,
} from "../components/tool-panel-kit";
import { useToolDraftState } from "../components/use-tool-draft-state";
import { useToolFeedback } from "../components/use-tool-feedback";
import type { ToolPanelProps } from "../types";
import { commonPanelCopy, formatToolError } from "./panel-copy";

const TOOL_DRAFT_KEY = "tool:sql.format:draft:v1";
const AUTO_RUN_DELAY_MS = 350;

const keywordCaseOptions = ["preserve", "upper", "lower"] as const;
const identifierCaseOptions = ["preserve", "upper", "lower"] as const;
const indentOptions = [2, 4, 8] as const;

const panelCopy: Record<
  Locale,
  {
    title: string;
    placeholder: string;
    dialectLabel: string;
    keywordCaseLabel: string;
    identifierCaseLabel: string;
    indentLabel: string;
    prettyAction: string;
    compactAction: string;
    downloadAction: string;
    downloaded: string;
    downloadFailed: string;
    successMessage: Record<SqlFormatInput["mode"], string>;
    keywordCaseOptions: Record<SqlFormatInput["keywordCase"], string>;
    identifierCaseOptions: Record<SqlFormatInput["identifierCase"], string>;
    errorMessage: Record<string, string>;
  }
> = {
  "zh-CN": {
    title: "SQL 格式化",
    placeholder: "粘贴待处理的 SQL 文本，可按需格式化、压缩并切换方言与大小写规则",
    dialectLabel: "方言",
    keywordCaseLabel: "关键字",
    identifierCaseLabel: "标识符",
    indentLabel: "缩进",
    prettyAction: "格式化",
    compactAction: "压缩",
    downloadAction: "下载 SQL",
    downloaded: "SQL 文件已导出",
    downloadFailed: "导出失败",
    successMessage: {
      pretty: "SQL 已格式化",
      compact: "SQL 已压缩",
    },
    keywordCaseOptions: {
      preserve: "保持原样",
      upper: "转大写",
      lower: "转小写",
    },
    identifierCaseOptions: {
      preserve: "保持原样",
      upper: "转大写",
      lower: "转小写",
    },
    errorMessage: {
      INVALID_INPUT: "输入参数无效",
      INVALID_SQL: "SQL 格式化失败",
      FORMAT_EMPTY_RESULT: "格式化结果为空",
    },
  },
  "en-US": {
    title: "SQL Formatter",
    placeholder: "Paste SQL content to format, minify, and switch dialect or casing options",
    dialectLabel: "Dialect",
    keywordCaseLabel: "Keywords",
    identifierCaseLabel: "Identifiers",
    indentLabel: "Indent",
    prettyAction: "Pretty",
    compactAction: "Minify",
    downloadAction: "Download SQL",
    downloaded: "SQL file saved",
    downloadFailed: "Save failed",
    successMessage: {
      pretty: "SQL formatted",
      compact: "SQL minified",
    },
    keywordCaseOptions: {
      preserve: "Preserve",
      upper: "Upper",
      lower: "Lower",
    },
    identifierCaseOptions: {
      preserve: "Preserve",
      upper: "Upper",
      lower: "Lower",
    },
    errorMessage: {
      INVALID_INPUT: "Invalid input",
      INVALID_SQL: "SQL formatting failed",
      FORMAT_EMPTY_RESULT: "Output is empty",
    },
  },
};

const dialectLabels: Record<SqlDialect, Record<Locale, string>> = {
  bigquery: { "zh-CN": "BigQuery", "en-US": "BigQuery" },
  clickhouse: { "zh-CN": "ClickHouse", "en-US": "ClickHouse" },
  db2: { "zh-CN": "DB2", "en-US": "DB2" },
  db2i: { "zh-CN": "DB2i", "en-US": "DB2i" },
  duckdb: { "zh-CN": "DuckDB", "en-US": "DuckDB" },
  hive: { "zh-CN": "Hive", "en-US": "Hive" },
  mariadb: { "zh-CN": "MariaDB", "en-US": "MariaDB" },
  mysql: { "zh-CN": "MySQL", "en-US": "MySQL" },
  n1ql: { "zh-CN": "N1QL", "en-US": "N1QL" },
  plsql: { "zh-CN": "PL/SQL", "en-US": "PL/SQL" },
  postgresql: { "zh-CN": "PostgreSQL", "en-US": "PostgreSQL" },
  redshift: { "zh-CN": "Redshift", "en-US": "Redshift" },
  spark: { "zh-CN": "Spark SQL", "en-US": "Spark SQL" },
  sqlite: { "zh-CN": "SQLite", "en-US": "SQLite" },
  sql: { "zh-CN": "Standard SQL", "en-US": "Standard SQL" },
  tidb: { "zh-CN": "TiDB", "en-US": "TiDB" },
  trino: { "zh-CN": "Trino", "en-US": "Trino" },
  transactsql: { "zh-CN": "Transact-SQL", "en-US": "Transact-SQL" },
  tsql: { "zh-CN": "T-SQL", "en-US": "T-SQL" },
  singlestoredb: { "zh-CN": "SingleStoreDB", "en-US": "SingleStoreDB" },
  snowflake: { "zh-CN": "Snowflake", "en-US": "Snowflake" },
};

const defaultDraft: SqlFormatInput = {
  source: "",
  mode: "pretty",
  dialect: "sql",
  tabWidth: 2,
  keywordCase: "preserve",
  identifierCase: "preserve",
};

const normalizeDraft = (
  value: Partial<SqlFormatInput> | SqlFormatInput | null | undefined,
): SqlFormatInput => {
  const parsed = sqlFormatInputSchema.safeParse({
    ...defaultDraft,
    ...(value ?? {}),
  });

  return parsed.success ? parsed.data : defaultDraft;
};

const stringifyResult = (result: SqlFormatOutput) => result.formatted;

export const SqlFormatPanel = ({
  autoCopyOnSuccess,
  bridge,
  locale,
  notify,
  storage,
}: ToolPanelProps) => {
  const text = panelCopy[locale];
  const common = commonPanelCopy[locale];
  const [rawDraft, setDraft] = useToolDraftState<SqlFormatInput>(
    storage,
    TOOL_DRAFT_KEY,
    defaultDraft,
  );
  const draft = useMemo(() => normalizeDraft(rawDraft), [rawDraft]);
  const autoRunTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(
    null,
  );
  const [result, setResult] = useState<SqlFormatOutput | null>(null);
  const { feedback, setFeedback, copyText, reportSuccess } = useToolFeedback({
    autoCopyOnSuccess,
    bridge,
    copiedText: common.copied,
    copyFailedText: common.copyFailed,
    notify,
  });

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

  const resetResult = () => {
    setResult(null);
    setFeedback(null);
  };

  const updateDraft = (value: Partial<SqlFormatInput>) => {
    const nextInput = normalizeDraft({
      ...draft,
      ...value,
    });

    resetResult();
    setDraft(nextInput);
    scheduleFormat(nextInput);
  };

  const executeFormat = (input: SqlFormatInput) => {
    clearAutoRunTimeout();

    if (!input.source.trim()) {
      resetResult();
      return;
    }

    const nextResult = formatSql(input);

    if (!nextResult.ok) {
      setResult(null);
      setFeedback({
        tone: "error",
        text: formatToolError(nextResult.error, text.errorMessage),
      });
      return;
    }

    setResult(nextResult.data);
    reportSuccess(text.successMessage[input.mode], nextResult.data.formatted);
  };

  const scheduleFormat = (input: SqlFormatInput) => {
    clearAutoRunTimeout();

    if (!input.source.trim()) {
      resetResult();
      return;
    }

    autoRunTimeoutRef.current = window.setTimeout(() => {
      executeFormat(input);
    }, AUTO_RUN_DELAY_MS);
  };

  const runFormat = (mode: SqlFormatInput["mode"]) => {
    const nextInput = {
      ...draft,
      mode,
    };

    setDraft(nextInput);
    executeFormat(nextInput);
  };

  const handleDownload = async () => {
    if (!result) {
      return;
    }

    try {
      await bridge.saveTextFile("sql-result.sql", result.formatted);
      setFeedback({
        tone: "success",
        text: text.downloaded,
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        text: `${text.downloadFailed}: ${error instanceof Error ? error.message : ""}`.trim(),
      });
    }
  };

  const isEnglish = locale === "en-US";

  return (
    <ToolGrid docked>
      <ToolPane title={text.title}>
        <Textarea
          className="min-h-[18rem] max-h-[60dvh] flex-1 resize-none font-mono text-[13px] leading-6 xl:min-h-0 xl:max-h-none"
          placeholder={text.placeholder}
          spellCheck={false}
          value={draft.source}
          onChange={(event) => {
            updateDraft({ source: event.currentTarget.value });
          }}
        />
      </ToolPane>

      <ToolPane hideHeader>
        <ToolCodeBlock
          placeholder={common.resultPlaceholder}
          value={result ? stringifyResult(result) : ""}
        />
      </ToolPane>

      <ToolActionDock
        feedback={feedback}
        leftActions={
          <>
            <Button
              className={cn(isEnglish && "px-2.5 text-xs")}
              data-tool-primary-action="true"
              size="sm"
              variant="secondary"
              onClick={() => {
                runFormat("pretty");
              }}
            >
              {text.prettyAction}
            </Button>
            <Button
              className={cn(isEnglish && "px-2.5 text-xs")}
              size="sm"
              variant="secondary"
              onClick={() => {
                runFormat("compact");
              }}
            >
              {text.compactAction}
            </Button>
            <ToolSelect
              aria-label={text.dialectLabel}
              className={cn(
                "h-9 shrink-0 px-2.5 text-xs",
                isEnglish ? "w-[120px] sm:w-[146px]" : "w-[108px] sm:w-[132px]",
              )}
              value={draft.dialect}
              onValueChange={(value) => {
                updateDraft({ dialect: value as SqlDialect });
              }}
            >
              {sqlDialectOptions.map((option) => (
                <option key={option} value={option}>
                  {dialectLabels[option][locale]}
                </option>
              ))}
            </ToolSelect>
            <ToolSelect
              aria-label={text.keywordCaseLabel}
              className={cn(
                "h-9 shrink-0 px-2.5 text-xs",
                isEnglish ? "w-[96px] sm:w-[108px]" : "w-[100px] sm:w-[112px]",
              )}
              value={draft.keywordCase}
              onValueChange={(value) => {
                updateDraft({
                  keywordCase: value as SqlFormatInput["keywordCase"],
                });
              }}
            >
              {keywordCaseOptions.map((option) => (
                <option key={option} value={option}>
                  {text.keywordCaseOptions[option]}
                </option>
              ))}
            </ToolSelect>
            <ToolSelect
              aria-label={text.identifierCaseLabel}
              className={cn(
                "h-9 shrink-0 px-2.5 text-xs",
                isEnglish ? "w-[104px] sm:w-[120px]" : "w-[100px] sm:w-[112px]",
              )}
              value={draft.identifierCase}
              onValueChange={(value) => {
                updateDraft({
                  identifierCase: value as SqlFormatInput["identifierCase"],
                });
              }}
            >
              {identifierCaseOptions.map((option) => (
                <option key={option} value={option}>
                  {text.identifierCaseOptions[option]}
                </option>
              ))}
            </ToolSelect>
            <ToolSelect
              aria-label={text.indentLabel}
              className={cn(
                "h-9 shrink-0 px-2.5 text-xs",
                isEnglish ? "w-[76px] sm:w-[88px]" : "w-[84px] sm:w-[96px]",
              )}
              value={String(draft.tabWidth)}
              onValueChange={(value) => {
                updateDraft({ tabWidth: Number(value) });
              }}
            >
              {indentOptions.map((option) => (
                <option key={option} value={String(option)}>
                  {locale === "zh-CN" ? `${option} 格` : `${option} spaces`}
                </option>
              ))}
            </ToolSelect>
            <Button
              className={cn(isEnglish && "px-2.5 text-xs")}
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft(defaultDraft);
                resetResult();
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
                  void copyText(stringifyResult(result));
                }
              }}
            >
              {common.copy}
            </Button>
            <Button
              disabled={!result}
              size="sm"
              variant="secondary"
              onClick={() => {
                void handleDownload();
              }}
            >
              {text.downloadAction}
            </Button>
          </>
        }
      />
    </ToolGrid>
  );
};
