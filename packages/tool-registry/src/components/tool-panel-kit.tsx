import {
  type ButtonHTMLAttributes,
  Children,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
} from "@z-dev-toolbox/ui";

export const toolInsetBorderClassName =
  "border-[rgb(var(--color-border)/var(--panel-inner-border-alpha))]";

export const toolInsetPanelClassName =
  "border-[rgb(var(--color-border)/var(--panel-inner-border-alpha))] bg-[linear-gradient(180deg,rgb(var(--color-surface)/var(--panel-inner-surface-top-alpha)),rgb(var(--color-surface-strong)/var(--panel-inner-surface-bottom-alpha)))] shadow-[0_18px_30px_-28px_rgb(var(--color-shadow-ambient)/0.34)]";

const paneHeaderControlClassName =
  "[&_button]:min-h-0 [&_button]:text-xs [&_[data-tool-select-trigger='true']]:text-xs " +
  "[&_[data-tool-segmented='true']]:p-[3px] [&_[data-tool-segmented='true']_button]:h-7 [&_[data-tool-segmented='true']_button]:rounded-full [&_[data-tool-segmented='true']_button]:px-3 [&_[data-tool-segmented='true']_button]:text-[11px]";

export interface ToolFeedback {
  tone: "success" | "error" | "muted";
  text: string;
}

export const ToolGrid = ({
  docked = false,
  className,
  children,
}: {
  docked?: boolean;
  className?: string;
  children: ReactNode;
}) => (
  <div
    className={cn(
      "grid min-h-0 gap-2.5 sm:gap-3 xl:h-full xl:grid-cols-2",
      docked && "xl:grid-rows-[minmax(0,1fr)_auto]",
      className,
    )}
  >
    {children}
  </div>
);

export const ToolPane = ({
  title,
  headerCenter,
  toolbar,
  footer,
  hideHeader = false,
  className,
  children,
}: {
  title?: string;
  headerCenter?: ReactNode;
  toolbar?: ReactNode;
  footer?: ReactNode;
  hideHeader?: boolean;
  className?: string;
  children: ReactNode;
}) => {
  const shouldRenderHeader = !hideHeader && (title || headerCenter || toolbar);

  return (
    <Card className={cn("flex min-h-0 flex-col overflow-hidden", className)}>
      {shouldRenderHeader ? (
        <CardHeader className="border-b border-[rgb(var(--color-border)/var(--divider-border-alpha))] px-3 py-2.5 sm:px-4">
          <div className="flex flex-col gap-2 sm:hidden">
            {title || toolbar ? (
              <div className="flex min-w-0 items-center gap-2">
                {title ? (
                  <CardTitle className="min-w-0 flex-1 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted">
                    {title}
                  </CardTitle>
                ) : (
                  <div aria-hidden="true" className="min-w-0 flex-1" />
                )}
                <div
                  className={cn(
                    "flex min-w-0 flex-wrap items-center justify-end gap-2",
                    paneHeaderControlClassName,
                  )}
                >
                  {toolbar}
                </div>
              </div>
            ) : null}
            {headerCenter ? (
              <div
                className={cn(
                  "flex justify-center",
                  paneHeaderControlClassName,
                )}
              >
                {headerCenter}
              </div>
            ) : null}
          </div>
          <div
            className={cn(
              "hidden min-h-9 items-center gap-2.5 sm:grid",
              headerCenter
                ? "grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"
                : "grid-cols-[minmax(0,1fr)_auto]",
            )}
          >
            {title ? (
              <CardTitle className="min-w-0 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted">
                {title}
              </CardTitle>
            ) : (
              <div aria-hidden="true" className="min-w-0" />
            )}
            {headerCenter ? (
              <div
                className={cn(
                  "justify-self-center",
                  paneHeaderControlClassName,
                )}
              >
                {headerCenter}
              </div>
            ) : null}
            <div
              className={cn(
                "flex min-w-0 items-center gap-2",
                paneHeaderControlClassName,
                headerCenter ? "justify-self-end justify-end" : "justify-end",
              )}
            >
              {toolbar}
            </div>
          </div>
        </CardHeader>
      ) : null}
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 px-3 pb-3 pt-3 sm:px-4 sm:pb-4">
        {children}
        {footer}
      </CardContent>
    </Card>
  );
};

export const ToolFieldLabel = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "text-[0.7rem] font-medium uppercase tracking-[0.16em] text-muted",
      className,
    )}
  >
    {children}
  </div>
);

export const ToolControlField = ({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) => (
  <label
    className={cn(
      "inline-flex h-8 min-w-0 max-w-full items-center gap-2 rounded-[1rem] border px-3 text-xs text-muted [&_[data-tool-select-trigger='true']]:min-w-0 [&_[data-tool-select-trigger='true']]:max-w-full [&_[data-tool-select-trigger='true']]:flex-1",
      toolInsetPanelClassName,
      className,
    )}
  >
    <span className="shrink-0 whitespace-nowrap">{label}</span>
    {children}
  </label>
);

export const ToolHint = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "rounded-[20px] border border-[rgb(var(--color-border)/calc(var(--divider-border-alpha)+0.06))] bg-[rgb(var(--color-surface-muted)/0.14)] px-3.5 py-2.5 text-[0.82rem] leading-5 text-muted",
      className,
    )}
  >
    {children}
  </div>
);

export const ToolActionBar = ({
  feedback,
  actionsClassName,
  children,
}: {
  feedback?: ToolFeedback | null;
  actionsClassName?: string;
  children: ReactNode;
}) => {
  const { actionsRef, density } = useToolActionDensity();

  return (
    <div className="border-t border-[rgb(var(--color-border)/var(--divider-border-alpha))] pt-3">
      <div
        ref={actionsRef}
        className={cn(
          toolActionGroupClassName,
          actionsClassName,
          toolActionDensityClassMap[density],
        )}
      >
        {children}
      </div>
      {feedback ? (
        <div
          aria-live={feedback.tone === "error" ? "assertive" : "polite"}
          className="sr-only"
          role={feedback.tone === "error" ? "alert" : "status"}
        >
          {feedback.text}
        </div>
      ) : null}
    </div>
  );
};

export const ToolActionDock = ({
  feedback,
  className,
  leftActions,
  rightActions,
  leftActionsClassName,
  rightActionsClassName,
}: {
  feedback?: ToolFeedback | null;
  className?: string;
  leftActions?: ReactNode;
  rightActions?: ReactNode;
  leftActionsClassName?: string;
  rightActionsClassName?: string;
}) => {
  const { actionsRef, density } = useToolActionDensity({
    compactWidth: 1180,
    tightWidth: 860,
  });

  return (
    <Card
      className={cn(
        "xl:col-span-2 flex min-h-0 flex-col gap-3 overflow-hidden px-3 py-3 sm:px-4 sm:py-3.5",
        className,
      )}
    >
      <div
        ref={actionsRef}
        className={cn(
          toolActionDockClassName,
          toolActionGapClassMap[density],
          toolActionDensityClassMap[density],
        )}
      >
        {leftActions ? (
          <div
            className={cn(
              toolActionDockGroupClassName,
              "flex-1 justify-start",
              toolActionGapClassMap[density],
              leftActionsClassName,
            )}
          >
            {leftActions}
          </div>
        ) : null}
        {rightActions ? (
          <div
            className={cn(
              toolActionDockGroupClassName,
              "ml-auto justify-end",
              toolActionGapClassMap[density],
              rightActionsClassName,
            )}
          >
            {rightActions}
          </div>
        ) : null}
      </div>
      {feedback ? (
        <div
          aria-live={feedback.tone === "error" ? "assertive" : "polite"}
          className="sr-only"
          role={feedback.tone === "error" ? "alert" : "status"}
        >
          {feedback.text}
        </div>
      ) : null}
    </Card>
  );
};

export const ToolCodeBlock = ({
  value,
  placeholder,
  className,
}: {
  value: string;
  placeholder?: string;
  className?: string;
}) => {
  const hasValue = value.length > 0;

  return (
    <pre
      className={cn(
        "min-h-[18rem] max-h-[60dvh] flex-1 overflow-auto rounded-[24px] border px-4 py-3 font-mono text-[12px] leading-6 whitespace-pre-wrap break-all xl:min-h-0 xl:max-h-none",
        hasValue ? "text-foreground" : "text-muted",
        toolInsetPanelClassName,
        className,
      )}
    >
      {hasValue ? value : placeholder || ""}
    </pre>
  );
};

export const ToolEmptyState = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "flex min-h-[220px] flex-1 items-center justify-center rounded-[24px] border border-dashed px-6 text-center text-sm leading-6 text-muted",
      toolInsetPanelClassName,
      className,
    )}
  >
    {children}
  </div>
);

export const ToolMetaGrid = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div className={cn("grid grid-cols-2 gap-2 xl:grid-cols-3", className)}>
    {children}
  </div>
);

export const ToolMetaItem = ({
  label,
  value,
  className,
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "rounded-[22px] border px-3 py-2.5",
      toolInsetPanelClassName,
      className,
    )}
  >
    <div className="text-[0.68rem] uppercase tracking-[0.14em] text-muted">
      {label}
    </div>
    <div className="mt-1 break-all text-sm font-medium text-foreground">
      {value}
    </div>
  </div>
);

interface ToolSelectProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "onChange" | "value"
> {
  children: ReactNode;
  value?: string;
  onValueChange?: (value: string) => void;
  panelMaxWidth?: number;
  renderValue?: (option?: { value: string; label: ReactNode }) => ReactNode;
}

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    aria-hidden="true"
    className={cn("h-3.5 w-3.5 transition-transform", open ? "rotate-180" : "")}
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

export const ToolSelect = ({
  className,
  children,
  value,
  disabled,
  onValueChange,
  panelMaxWidth,
  renderValue,
  ...props
}: ToolSelectProps) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<{
    left: number;
    width: number;
    maxHeight: number;
    side: "top" | "bottom";
    offset: number;
  } | null>(null);
  const options = useMemo(
    () =>
      Children.toArray(children)
        .map((child) => {
          if (!isValidElement(child)) {
            return null;
          }

          const optionElement = child as ReactElement<{
            children?: ReactNode;
            value?: string;
          }>;

          return {
            value: String(optionElement.props.value ?? ""),
            label: optionElement.props.children,
          };
        })
        .filter(
          (
            item,
          ): item is {
            value: string;
            label: ReactNode;
          } => item !== null,
        ),
    [children],
  );
  const selectedOption =
    options.find((item) => item.value === value) ?? options[0];

  useEffect(() => {
    if (!open || !buttonRef.current) {
      return;
    }

    const updatePanelStyle = () => {
      const rect = buttonRef.current?.getBoundingClientRect();

      if (!rect) {
        return;
      }

      const spaceBelow = window.innerHeight - rect.bottom - 16;
      const spaceAbove = rect.top - 16;
      const openUpward = spaceBelow < 220 && spaceAbove >= spaceBelow;
      const availableHeight = Math.max(
        0,
        (openUpward ? spaceAbove : spaceBelow) - 8,
      );
      const maxHeight = Math.min(320, availableHeight);
      const estimatedWidth = getToolSelectPanelWidthEstimate(rect.width, options);
      const measuredWidth = panelRef.current
        ? Math.ceil(panelRef.current.scrollWidth)
        : estimatedWidth;
      const maxAllowedWidth = Math.min(
        panelMaxWidth ?? Number.POSITIVE_INFINITY,
        window.innerWidth - 16,
      );
      const width = Math.min(
        Math.max(rect.width, Math.min(Math.max(estimatedWidth, measuredWidth), maxAllowedWidth)),
        window.innerWidth - 16,
      );
      const left = Math.max(
        8,
        Math.min(rect.left, window.innerWidth - width - 8),
      );

      setPanelStyle({
        left,
        width,
        maxHeight,
        side: openUpward ? "bottom" : "top",
        offset: openUpward
          ? window.innerHeight - rect.top + 8
          : rect.bottom + 8,
      });
    };

    let frameId = 0;

    const handleOutsidePointer = (event: MouseEvent) => {
      const target = event.target;

      if (
        target instanceof Node &&
        (buttonRef.current?.contains(target) ||
          panelRef.current?.contains(target))
      ) {
        return;
      }

      setOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    updatePanelStyle();
    frameId = window.requestAnimationFrame(updatePanelStyle);
    window.addEventListener("resize", updatePanelStyle);
    window.addEventListener("scroll", updatePanelStyle, true);
    document.addEventListener("mousedown", handleOutsidePointer);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updatePanelStyle);
      window.removeEventListener("scroll", updatePanelStyle, true);
      document.removeEventListener("mousedown", handleOutsidePointer);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open, options, panelMaxWidth]);

  return (
    <>
      <button
        ref={buttonRef}
        data-tool-select-trigger="true"
        className={cn(
          "inline-flex h-10 min-w-0 max-w-full items-center justify-between gap-2 whitespace-nowrap rounded-[18px] border border-[rgb(var(--color-border)/var(--control-border-alpha))] bg-[linear-gradient(180deg,rgb(var(--color-surface)/0.98),rgb(var(--color-surface-strong)/0.94))] px-3 text-sm text-foreground shadow-[0_14px_26px_-26px_rgb(var(--color-shadow-ambient)/0.26)] outline-none transition-[background-color,border-color,color,box-shadow,transform]",
          "hover:-translate-y-0.5 hover:border-accent/16 hover:bg-surfaceStrong/98 hover:shadow-[0_18px_32px_-24px_rgb(var(--color-shadow-ambient)/0.32),0_8px_20px_-18px_rgb(var(--color-shadow-warm)/0.14)] focus:border-accent/26 focus:outline-none focus:ring-0 focus:shadow-[0_0_0_4px_rgb(var(--color-accent)/0.08),0_18px_34px_-24px_rgb(var(--color-shadow-ambient)/0.4)] focus-visible:outline-none focus-visible:ring-0",
          disabled && "cursor-not-allowed opacity-60",
          className,
        )}
        type="button"
        onClick={() => {
          if (disabled) {
            return;
          }

          setOpen((current) => !current);
        }}
        {...props}
      >
        <span className="min-w-0 flex-1 truncate text-left">
          {renderValue
            ? renderValue(selectedOption)
            : (selectedOption?.label ?? value)}
        </span>
        <span className="text-muted">
          <ChevronIcon open={open} />
        </span>
      </button>
      {open && panelStyle
        ? createPortal(
            <div
              ref={panelRef}
              className={cn(
                "fixed z-[90] overflow-hidden rounded-[20px] border p-1.5",
                toolInsetPanelClassName,
              )}
              style={{
                left: panelStyle.left,
                maxHeight: panelStyle.maxHeight,
                [panelStyle.side]: panelStyle.offset,
                width: panelStyle.width,
              }}
            >
              <div
                className={cn(
                  "max-h-full overflow-y-auto rounded-[18px] pr-0.5 [scrollbar-gutter:stable] [scrollbar-width:thin] [scrollbar-color:rgb(var(--color-surface-muted)/0.72)_transparent]",
                  "[&::-webkit-scrollbar]:w-3 [&::-webkit-scrollbar-track]:my-2 [&::-webkit-scrollbar-track]:rounded-full",
                  "[&::-webkit-scrollbar-track]:bg-[rgb(var(--color-border)/0.12)] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-[2px]",
                  "[&::-webkit-scrollbar-thumb]:border-[rgb(var(--color-surface-strong)/0.86)] [&::-webkit-scrollbar-thumb]:bg-[linear-gradient(180deg,rgb(var(--color-surface-muted)/0.86),rgb(var(--color-border)/0.92))]",
                  "[&::-webkit-scrollbar-thumb:hover]:bg-[linear-gradient(180deg,rgb(var(--color-accent)/0.62),rgb(var(--color-surface-muted)/0.96))]",
                )}
              >
                {options.map((option) => {
                  const isSelected = option.value === selectedOption?.value;

                  return (
                    <button
                      key={option.value}
                      className={cn(
                        "flex min-w-full items-center rounded-[15px] px-3 py-2 text-left text-sm transition-[background-color,color,box-shadow]",
                        isSelected
                          ? "bg-[linear-gradient(180deg,rgb(var(--color-surface)/0.98),rgb(var(--color-accent-soft)/0.84))] text-foreground shadow-[0_12px_20px_-18px_rgb(var(--color-shadow-warm)/0.18)]"
                          : "text-foreground hover:bg-surfaceStrong/88",
                      )}
                      type="button"
                      onClick={() => {
                        onValueChange?.(option.value);
                        setOpen(false);
                      }}
                    >
                      <span className="min-w-0 truncate whitespace-nowrap">
                        {option.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
};

const getToolSelectPanelWidthEstimate = (
  triggerWidth: number,
  options: Array<{ value: string; label: ReactNode }>,
) => {
  const longestLabelLength = options.reduce((currentMax, option) => {
    const labelText = getToolSelectLabelText(option.label)
      .replace(/\s+/g, " ")
      .trim();

    return Math.max(currentMax, labelText.length);
  }, 0);

  return Math.max(triggerWidth, longestLabelLength * 16 + 72);
};

const getToolSelectLabelText = (node: ReactNode): string => {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }

  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map((item) => getToolSelectLabelText(item)).join("");
  }

  if (isValidElement(node)) {
    return getToolSelectLabelText(
      (node.props as { children?: ReactNode }).children,
    );
  }

  return "";
};

export const ToolTagList = ({
  items,
  className,
}: {
  items: string[];
  className?: string;
}) => (
  <div className={cn("flex flex-wrap gap-2", className)}>
    {items.map((item) => (
      <Badge key={item}>{item}</Badge>
    ))}
  </div>
);

export const ToolSegmentedControl = ({
  value,
  options,
  onValueChange,
  className,
}: {
  value: string;
  options: Array<{
    value: string;
    label: ReactNode;
  }>;
  onValueChange: (value: string) => void;
  className?: string;
}) => (
  <div
    data-tool-segmented="true"
    className={cn(
      "inline-flex items-center gap-1 rounded-full border border-[rgb(var(--color-border)/calc(var(--control-border-alpha)-0.05))] bg-background/52 p-1 shadow-[0_10px_18px_-18px_rgb(var(--color-shadow-ambient)/0.18)]",
      className,
    )}
  >
    {options.map((option) => {
      const isActive = option.value === value;

      return (
        <button
          key={option.value}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition-[background-color,color,box-shadow]",
            isActive
              ? "bg-[linear-gradient(180deg,rgb(var(--color-surface)/0.98),rgb(var(--color-accent-soft)/0.88))] text-foreground shadow-[0_14px_22px_-16px_rgb(var(--color-shadow-ambient)/0.22),0_8px_18px_-14px_rgb(var(--color-shadow-warm)/0.2)]"
              : "text-muted hover:text-foreground",
          )}
          type="button"
          onClick={() => {
            if (!isActive) {
              onValueChange(option.value);
            }
          }}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);

const toolActionGroupClassName =
  "min-w-0 flex flex-wrap items-center pb-1 pr-0.5 [&>*]:max-w-full";

const toolActionDockClassName =
  "min-w-0 flex flex-wrap items-start justify-start";

const toolActionDockGroupClassName =
  "flex min-w-0 max-w-full flex-wrap items-center [&>*]:max-w-full";

const toolActionGapClassMap = {
  default: "gap-2.5",
  compact: "gap-2",
  tight: "gap-2",
} satisfies Record<"default" | "compact" | "tight", string>;

const toolActionDensityClassMap = {
  default: "",
  compact:
    "[&_button]:h-8 [&_button]:rounded-[1rem] [&_button]:px-2.5 [&_button]:text-xs [&_button]:leading-none [&_[data-tool-select-trigger='true']]:min-w-[4.75rem] [&_label]:h-7 [&_label]:gap-1.5 [&_label]:px-2.5 [&_label]:text-[11px]",
  tight:
    "[&_button]:h-8 [&_button]:rounded-[1rem] [&_button]:px-2 [&_button]:text-[11px] [&_button]:leading-none [&_[data-tool-select-trigger='true']]:min-w-[4.25rem] [&_[data-tool-select-trigger='true']]:px-2 [&_label]:h-7 [&_label]:gap-1.5 [&_label]:px-2 [&_label]:text-[11px]",
} satisfies Record<"default" | "compact" | "tight", string>;

const useToolActionDensity = ({
  compactWidth = 640,
  tightWidth = 430,
}: {
  compactWidth?: number;
  tightWidth?: number;
} = {}) => {
  const actionsRef = useRef<HTMLDivElement>(null);
  const [density, setDensity] = useState<"default" | "compact" | "tight">(
    "default",
  );

  useEffect(() => {
    const node = actionsRef.current;

    if (!node || typeof ResizeObserver === "undefined") {
      return;
    }

    const updateDensity = (width: number) => {
      setDensity((current) => {
        if (width < tightWidth) {
          return current === "tight" ? current : "tight";
        }

        if (width < compactWidth) {
          return current === "compact" ? current : "compact";
        }

        return current === "default" ? current : "default";
      });
    };

    updateDensity(node.getBoundingClientRect().width);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (!entry) {
        return;
      }

      updateDensity(entry.contentRect.width);
    });

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [compactWidth, tightWidth]);

  return {
    actionsRef,
    density,
  };
};
