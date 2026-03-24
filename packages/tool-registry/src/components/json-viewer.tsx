import type { JsonSortOrder, JsonValue } from "@z-dev-toolbox/core";
import { cn } from "@z-dev-toolbox/ui";

import { toolInsetPanelClassName } from "./tool-panel-kit";

interface JsonViewerProps {
  collapsedPaths: Record<string, boolean>;
  displayMode: "view" | "text";
  formatted: string;
  placeholder: string;
  sortOrder: JsonSortOrder;
  value: JsonValue | null;
  onTogglePath: (path: string) => void;
}

interface JsonTreeLine {
  id: string;
  path: string;
  depth: number;
  lineNumber: number;
  keyName?: string;
  comma: boolean;
  variant:
    | "primitive"
    | "container-open"
    | "container-close"
    | "container-summary";
  value?: JsonValue;
  containerType?: "object" | "array";
  itemCount?: number;
}

interface JsonTreeBuildResult {
  lines: JsonTreeLine[];
  lineCount: number;
}

const isJsonObject = (
  value: JsonValue,
): value is { [key: string]: JsonValue } =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const jsonKeyCollator = new Intl.Collator(undefined, {
  numeric: false,
  sensitivity: "variant",
});

const sortJsonObjectEntries = (
  entries: Array<[string, JsonValue]>,
  sortOrder: JsonSortOrder,
) => {
  if (sortOrder === "none") {
    return entries;
  }

  return [...entries].sort(([left], [right]) =>
    sortOrder === "asc"
      ? jsonKeyCollator.compare(left, right)
      : jsonKeyCollator.compare(right, left),
  );
};

const isUrlString = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const buildJsonTreeLines = ({
  value,
  depth,
  path,
  keyName,
  isLast,
  collapsedPaths,
  sortOrder,
  startLine,
}: {
  value: JsonValue;
  depth: number;
  path: string;
  keyName?: string;
  isLast: boolean;
  collapsedPaths: Record<string, boolean>;
  sortOrder: JsonSortOrder;
  startLine: number;
}): JsonTreeBuildResult => {
  if (Array.isArray(value)) {
    const itemCount = value.length;

    if (itemCount === 0) {
      return {
        lines: [
          {
            id: `${path}:summary`,
            path,
            depth,
            lineNumber: startLine,
            keyName,
            comma: !isLast,
            variant: "container-summary",
            containerType: "array",
            itemCount,
          },
        ],
        lineCount: 1,
      };
    }

    let nextLineNumber = startLine + 1;
    const childLines: JsonTreeLine[] = [];

    value.forEach((item, index) => {
      const childResult = buildJsonTreeLines({
        value: item,
        depth: depth + 1,
        path: `${path}[${index}]`,
        isLast: index === value.length - 1,
        collapsedPaths,
        sortOrder,
        startLine: nextLineNumber,
      });

      childLines.push(...childResult.lines);
      nextLineNumber += childResult.lineCount;
    });

    const lineCount = nextLineNumber - startLine + 1;

    if (collapsedPaths[path]) {
      return {
        lines: [
          {
            id: `${path}:summary`,
            path,
            depth,
            lineNumber: startLine,
            keyName,
            comma: !isLast,
            variant: "container-summary",
            containerType: "array",
            itemCount,
          },
        ],
        lineCount,
      };
    }

    return {
      lines: [
        {
          id: `${path}:open`,
          path,
          depth,
          lineNumber: startLine,
          keyName,
          comma: false,
          variant: "container-open",
          containerType: "array",
          itemCount,
        },
        ...childLines,
        {
          id: `${path}:close`,
          path,
          depth,
          lineNumber: startLine + lineCount - 1,
          comma: !isLast,
          variant: "container-close",
          containerType: "array",
          itemCount,
        },
      ],
      lineCount,
    };
  }

  if (isJsonObject(value)) {
    const entries = sortJsonObjectEntries(Object.entries(value), sortOrder);
    const itemCount = entries.length;

    if (itemCount === 0) {
      return {
        lines: [
          {
            id: `${path}:summary`,
            path,
            depth,
            lineNumber: startLine,
            keyName,
            comma: !isLast,
            variant: "container-summary",
            containerType: "object",
            itemCount,
          },
        ],
        lineCount: 1,
      };
    }

    let nextLineNumber = startLine + 1;
    const childLines: JsonTreeLine[] = [];

    entries.forEach(([childKey, childValue], index) => {
      const childResult = buildJsonTreeLines({
        value: childValue,
        depth: depth + 1,
        path: `${path}.${childKey}`,
        keyName: childKey,
        isLast: index === entries.length - 1,
        collapsedPaths,
        sortOrder,
        startLine: nextLineNumber,
      });

      childLines.push(...childResult.lines);
      nextLineNumber += childResult.lineCount;
    });

    const lineCount = nextLineNumber - startLine + 1;

    if (collapsedPaths[path]) {
      return {
        lines: [
          {
            id: `${path}:summary`,
            path,
            depth,
            lineNumber: startLine,
            keyName,
            comma: !isLast,
            variant: "container-summary",
            containerType: "object",
            itemCount,
          },
        ],
        lineCount,
      };
    }

    return {
      lines: [
        {
          id: `${path}:open`,
          path,
          depth,
          lineNumber: startLine,
          keyName,
          comma: false,
          variant: "container-open",
          containerType: "object",
          itemCount,
        },
        ...childLines,
        {
          id: `${path}:close`,
          path,
          depth,
          lineNumber: startLine + lineCount - 1,
          comma: !isLast,
          variant: "container-close",
          containerType: "object",
          itemCount,
        },
      ],
      lineCount,
    };
  }

  return {
    lines: [
      {
        id: `${path}:value`,
        path,
        depth,
        lineNumber: startLine,
        keyName,
        comma: !isLast,
        variant: "primitive",
        value,
      },
    ],
    lineCount: 1,
  };
};

const renderJsonString = (value: string) => {
  if (!isUrlString(value)) {
    return <span className="text-success">{JSON.stringify(value)}</span>;
  }

  return (
    <span className="text-success">
      "
      <a
        className="underline underline-offset-4 hover:opacity-85"
        href={value}
        rel="noreferrer"
        target="_blank"
      >
        {value}
      </a>
      "
    </span>
  );
};

const renderPrimitiveValue = (value: JsonValue) => {
  if (typeof value === "string") {
    return renderJsonString(value);
  }

  if (typeof value === "number") {
    return <span className="text-accent">{value}</span>;
  }

  if (typeof value === "boolean") {
    return <span className="text-danger">{String(value)}</span>;
  }

  return <span className="text-muted">null</span>;
};

const renderContainerBadge = (
  containerType: "object" | "array",
  itemCount: number,
) => (
  <span className="ml-2 text-[11px] text-muted">
    {containerType === "object" ? "Object" : "Array"}({itemCount})
  </span>
);

const renderContainerToken = (line: JsonTreeLine) => {
  if (!line.containerType) {
    return null;
  }

  if (line.variant === "container-open") {
    return (
      <>
        <span className="text-muted">
          {line.containerType === "object" ? "{" : "["}
        </span>
        {renderContainerBadge(line.containerType, line.itemCount ?? 0)}
      </>
    );
  }

  if (line.variant === "container-close") {
    return (
      <span className="text-muted">
        {line.containerType === "object" ? "}" : "]"}
      </span>
    );
  }

  const isEmpty = (line.itemCount ?? 0) === 0;
  const summaryToken =
    line.containerType === "object"
      ? isEmpty
        ? "{}"
        : "{ ... }"
      : isEmpty
        ? "[]"
        : "[ ... ]";

  return (
    <>
      <span className="text-muted">{summaryToken}</span>
      {renderContainerBadge(line.containerType, line.itemCount ?? 0)}
    </>
  );
};

const Chevron = ({ collapsed }: { collapsed: boolean }) => (
  <svg
    aria-hidden="true"
    className={cn(
      "h-3 w-3 transition-transform",
      collapsed ? "-rotate-90" : "",
    )}
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.8"
    viewBox="0 0 24 24"
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const JsonRawViewer = ({
  formatted,
  placeholder,
}: {
  formatted: string;
  placeholder: string;
}) => {
  if (!formatted) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted">
        {placeholder}
      </div>
    );
  }

  const lines = formatted.split("\n");

  return (
    <div className="min-w-full font-mono text-[12px] leading-6">
      {lines.map((line, index) => (
        <div
          key={`raw-${index + 1}`}
          className="grid grid-cols-[56px_minmax(0,1fr)] border-b border-[rgb(var(--color-border)/0.16)] last:border-b-0"
        >
          <div className="select-none border-r border-[rgb(var(--color-border)/0.16)] bg-[rgb(var(--color-surface-muted)/0.16)] px-3 text-right text-[11px] text-muted">
            {index + 1}
          </div>
          <div className="px-3 py-0.5 font-mono text-success whitespace-pre-wrap break-all">
            {line || " "}
          </div>
        </div>
      ))}
    </div>
  );
};

export const JsonViewer = ({
  collapsedPaths,
  displayMode,
  formatted,
  placeholder,
  sortOrder,
  value,
  onTogglePath,
}: JsonViewerProps) => {
  if (!formatted || value === null) {
    return (
      <div
        className={cn(
          "flex min-h-[18rem] max-h-[60dvh] flex-1 items-center justify-center rounded-[24px] border px-4 text-sm text-muted xl:min-h-0 xl:max-h-none",
          toolInsetPanelClassName,
        )}
      >
        {placeholder}
      </div>
    );
  }

  const treeLines =
    displayMode === "text"
      ? []
      : buildJsonTreeLines({
          value,
          depth: 0,
          path: "$",
          isLast: true,
          collapsedPaths,
          sortOrder,
          startLine: 1,
        }).lines;

  return (
    <div
      className={cn(
        "flex min-h-[18rem] max-h-[60dvh] flex-1 flex-col overflow-hidden rounded-[24px] border xl:min-h-0 xl:max-h-none",
        toolInsetPanelClassName,
      )}
    >
      <div className="min-h-0 flex-1 overflow-auto">
        {displayMode === "text" ? (
          <JsonRawViewer formatted={formatted} placeholder={placeholder} />
        ) : (
          <div className="min-w-full font-mono text-[12px] leading-6">
            {treeLines.map((line) => {
              const isCollapsible =
                (line.variant === "container-open" ||
                  line.variant === "container-summary") &&
                (line.itemCount ?? 0) > 0;

              return (
                <div
                  key={line.id}
                  className="grid grid-cols-[56px_minmax(0,1fr)] border-b border-[rgb(var(--color-border)/0.16)] last:border-b-0"
                >
                  <div className="select-none border-r border-[rgb(var(--color-border)/0.16)] bg-[rgb(var(--color-surface-muted)/0.16)] px-3 text-right text-[11px] text-muted">
                    {line.lineNumber}
                  </div>
                  <div className="min-w-0 px-3 py-0.5">
                    <div
                      className="flex min-w-0 items-start gap-2 whitespace-pre-wrap break-all"
                      style={{ paddingLeft: `${line.depth * 18}px` }}
                    >
                      {isCollapsible ? (
                        <button
                          className="mt-[5px] inline-flex h-3 w-3 items-center justify-center rounded-sm p-0 text-muted transition-colors hover:text-foreground"
                          type="button"
                          onClick={() => {
                            onTogglePath(line.path);
                          }}
                        >
                          <Chevron
                            collapsed={Boolean(collapsedPaths[line.path])}
                          />
                        </button>
                      ) : (
                        <span className="inline-block h-3 w-3" />
                      )}

                      <div className="min-w-0 flex-1">
                        {line.keyName ? (
                          <>
                            <span className="text-accent">
                              {JSON.stringify(line.keyName)}
                            </span>
                            <span className="text-muted">: </span>
                          </>
                        ) : null}

                        {line.variant === "primitive"
                          ? renderPrimitiveValue(line.value ?? null)
                          : renderContainerToken(line)}

                        {line.comma ? (
                          <span className="text-muted">,</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
