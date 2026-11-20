import { Fragment, useId, useLayoutEffect, useRef, useState } from "react";
import {
  Compartment,
  EditorState,
  StateEffect,
  StateField,
  Transaction,
} from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import {
  Decoration,
  EditorView,
  drawSelection,
  keymap,
  lineNumbers,
  type DecorationSet,
} from "@codemirror/view";
import type { TextDiffHighlightMode, TextDiffRow } from "@z-dev-toolbox/core";

import { toolInsetPanelClassName } from "../components/tool-panel-kit";
import {
  buildDiffDecorations,
  getDiffLineBounds,
  getDiffLineRange,
  DIFF_ROW_HEIGHT,
  type DiffRange,
  type DiffViewerSide,
} from "./text-diff-decorations";

interface TextDiffViewerProps {
  highlightMode: TextDiffHighlightMode;
  rows: TextDiffRow[];
  diffRanges: DiffRange[];
  before: string;
  after: string;
  beforeLabel: string;
  afterLabel: string;
  errorText?: string | null;
  activeDiffRange?: DiffRange | null;
  navigationRequest: number;
  onBeforeChange: (value: string) => void;
  onAfterChange: (value: string) => void;
}

interface DiffConnector {
  range: DiffRange;
  left: DiffRange;
  right: DiffRange;
  leftBounds: DiffRange;
  rightBounds: DiffRange;
}

const setDiffDecorations = StateEffect.define<DecorationSet>();
const diffDecorations = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update: (decorations, transaction) => {
    for (const effect of transaction.effects) {
      if (effect.is(setDiffDecorations)) return effect.value;
    }
    return decorations.map(transaction.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
});

const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    color: "rgb(var(--color-foreground))",
    fontSize: "12px",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    lineHeight: "24px",
    scrollbarWidth: "thin",
  },
  ".cm-content": {
    padding: "0",
    minHeight: "100%",
    caretColor: "rgb(var(--color-foreground))",
  },
  ".cm-line": {
    boxSizing: "border-box",
    height: `${DIFF_ROW_HEIGHT}px`,
    boxShadow: "inset 0 -1px rgb(var(--color-border) / 0.12)",
    padding: "4px 12px",
    lineHeight: "24px",
  },
  ".cm-gutters": {
    backgroundColor: "rgb(var(--color-surface-muted) / 0.22)",
    color: "rgb(var(--color-muted))",
    borderRight: "1px solid rgb(var(--color-border) / 0.12)",
  },
  ".cm-lineNumbers": { minWidth: "55px" },
  ".cm-lineNumbers .cm-gutterElement": {
    padding: "0 8px",
    fontSize: "11px",
    lineHeight: `${DIFF_ROW_HEIGHT}px`,
  },
  ".cm-diff-removed": { backgroundColor: "rgb(var(--color-danger) / 0.1)" },
  ".cm-diff-added": { backgroundColor: "rgb(var(--color-success) / 0.1)" },
  ".cm-diff-active": {
    boxShadow:
      "inset 3px 0 rgb(var(--color-accent)), inset 0 -1px rgb(var(--color-border) / 0.12)",
  },
  ".cm-diff-inline-removed": {
    borderRadius: "2px",
    backgroundColor: "rgb(var(--color-danger) / 0.18)",
    color: "rgb(var(--color-danger))",
  },
  ".cm-diff-inline-added": {
    borderRadius: "2px",
    backgroundColor: "rgb(var(--color-success) / 0.18)",
    color: "rgb(var(--color-success))",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
    { backgroundColor: "rgb(var(--color-accent) / 0.22)" },
  ".cm-cursor": { borderLeftColor: "rgb(var(--color-foreground))" },
});

export const TextDiffViewer = (props: TextDiffViewerProps) => {
  const {
    before,
    after,
    rows,
    highlightMode,
    activeDiffRange,
    navigationRequest,
    beforeLabel,
    afterLabel,
    errorText,
  } = props;
  const leftHostRef = useRef<HTMLDivElement>(null);
  const rightHostRef = useRef<HTMLDivElement>(null);
  const connectorHostRef = useRef<HTMLDivElement>(null);
  const [{ connectors, clip }, setConnectorLayout] = useState<{
    connectors: DiffConnector[];
    clip: DiffRange;
  }>({ connectors: [], clip: { start: 0, end: 0 } });
  const connectorGradientId = useId();
  const connectorClipId = `${connectorGradientId}-clip`;
  const measureConnectorsRef = useRef<() => void>(() => {});
  const editorsRef = useRef<
    Partial<
      Record<
        DiffViewerSide,
        {
          view: EditorView;
          label: string;
          attributes: Compartment;
          decoratedDoc: EditorState["doc"];
        }
      >
    >
  >({});
  const propsRef = useRef(props);
  const syncFrameRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    propsRef.current = props;
  });

  useLayoutEffect(() => {
    const mountEditor = (side: DiffViewerSide, parent: HTMLDivElement) => {
      const initial = propsRef.current;
      const label = side === "left" ? initial.beforeLabel : initial.afterLabel;
      const source = side === "left" ? initial.before : initial.after;
      const attributes = new Compartment();
      const view = new EditorView({
        parent,
        state: EditorState.create({
          doc: source,
          extensions: [
            editorTheme,
            diffDecorations,
            lineNumbers(),
            drawSelection(),
            history(),
            keymap.of([
              // The app shell handles Shift+Enter to return to tool search.
              { key: "Shift-Enter", run: () => true },
              ...defaultKeymap,
              ...historyKeymap,
            ]),
            attributes.of(
              EditorView.contentAttributes.of({
                "aria-label": label,
                spellcheck: "false",
              }),
            ),
            EditorView.updateListener.of((update) => {
              if (
                update.docChanged ||
                update.geometryChanged ||
                update.viewportChanged
              )
                measureConnectorsRef.current();
              if (!update.docChanged) return;
              const onChange =
                side === "left"
                  ? propsRef.current.onBeforeChange
                  : propsRef.current.onAfterChange;
              onChange(update.state.doc.toString());
            }),
            EditorView.domEventHandlers({
              scroll: (event, currentView) => {
                if (event.target === currentView.scrollDOM)
                  measureConnectorsRef.current();
                if (
                  event.target !== currentView.scrollDOM ||
                  window.innerWidth < 1024 ||
                  syncFrameRef.current !== null
                )
                  return;
                const opposite =
                  editorsRef.current[side === "left" ? "right" : "left"]?.view
                    .scrollDOM;
                if (!opposite) return;
                opposite.scrollTop = currentView.scrollDOM.scrollTop;
                opposite.scrollLeft = currentView.scrollDOM.scrollLeft;
                syncFrameRef.current = window.requestAnimationFrame(() => {
                  syncFrameRef.current = null;
                });
              },
            }),
          ],
        }),
      });
      editorsRef.current[side] = {
        view,
        label,
        attributes,
        decoratedDoc: view.state.doc,
      };
      // Loading an older draft may normalize CRLF through the editor's text model.
      if (view.state.doc.toString() !== source) {
        (side === "left" ? initial.onBeforeChange : initial.onAfterChange)(
          view.state.doc.toString(),
        );
      }
    };
    if (leftHostRef.current) mountEditor("left", leftHostRef.current);
    if (rightHostRef.current) mountEditor("right", rightHostRef.current);
    return () => {
      for (const editor of Object.values(editorsRef.current))
        editor.view.destroy();
      editorsRef.current = {};
      if (syncFrameRef.current !== null)
        window.cancelAnimationFrame(syncFrameRef.current);
      syncFrameRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    const host = connectorHostRef.current;
    if (!host) return;
    const measure = () => {
      const left = editorsRef.current.left?.view;
      const right = editorsRef.current.right?.view;
      if (!left || !right) return;
      left.requestMeasure({
        key: host,
        read: () => {
          const emptyLayout = { connectors: [], clip: { start: 0, end: 0 } };
          if (!host.clientWidth) return emptyLayout;
          // A document edit can precede React's matching decoration update.
          if (
            editorsRef.current.left?.decoratedDoc !== left.state.doc ||
            editorsRef.current.right?.decoratedDoc !== right.state.doc
          )
            return emptyLayout;
          const hostTop = host.getBoundingClientRect().top;
          const leftViewport = left.scrollDOM.getBoundingClientRect();
          const rightViewport = right.scrollDOM.getBoundingClientRect();
          const clip = {
            start: Math.max(leftViewport.top, rightViewport.top) - hostTop,
            end:
              Math.min(
                leftViewport.top + left.scrollDOM.clientHeight,
                rightViewport.top + right.scrollDOM.clientHeight,
              ) - hostTop,
          };
          const current = propsRef.current;
          const measureSide = (
            view: EditorView,
            bounds: DiffRange,
          ): DiffRange => {
            const origin = view.documentTop - hostTop;
            if (bounds.start === bounds.end) {
              const top =
                origin +
                (bounds.start === 0
                  ? 0
                  : view.lineBlockAt(view.state.doc.line(bounds.start).from)
                      .bottom);
              return { start: top, end: top };
            }
            return {
              start:
                origin +
                view.lineBlockAt(view.state.doc.line(bounds.start + 1).from)
                  .top,
              end:
                origin +
                view.lineBlockAt(view.state.doc.line(bounds.end).from).bottom,
            };
          };
          const connectors = current.diffRanges.flatMap((range) => {
            const active = current.activeDiffRange?.start === range.start;
            if (current.highlightMode === "none" && !active) return [];
            const leftBounds = getDiffLineBounds(current.rows, "left", range);
            const rightBounds = getDiffLineBounds(current.rows, "right", range);
            const leftPosition = measureSide(left, leftBounds);
            const rightPosition = measureSide(right, rightBounds);
            if (
              (leftPosition.end < clip.start &&
                rightPosition.end < clip.start) ||
              (leftPosition.start > clip.end && rightPosition.start > clip.end)
            )
              return [];
            return [
              {
                range,
                left: leftPosition,
                right: rightPosition,
                leftBounds,
                rightBounds,
              },
            ];
          });
          return { connectors, clip };
        },
        write: setConnectorLayout,
      });
    };
    measureConnectorsRef.current = measure;
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    if (leftHostRef.current) observer.observe(leftHostRef.current);
    if (rightHostRef.current) observer.observe(rightHostRef.current);
    measure();
    return () => {
      observer.disconnect();
      measureConnectorsRef.current = () => {};
    };
  }, []);

  useLayoutEffect(() => {
    for (const side of ["left", "right"] as const) {
      const editor = editorsRef.current[side];
      if (!editor) continue;
      const { view } = editor;
      const value = (side === "left" ? before : after).replace(/\r\n?/g, "\n");
      if (view.state.doc.toString() !== value) {
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: value },
          annotations: Transaction.addToHistory.of(false),
        });
      }
      const label = side === "left" ? beforeLabel : afterLabel;
      const effects: StateEffect<unknown>[] = [
        setDiffDecorations.of(
          buildDiffDecorations(
            view.state.doc,
            rows,
            side,
            highlightMode,
            activeDiffRange,
          ),
        ),
      ];
      if (editor.label !== label) {
        effects.push(
          editor.attributes.reconfigure(
            EditorView.contentAttributes.of({
              "aria-label": label,
              spellcheck: "false",
            }),
          ),
        );
        editor.label = label;
      }
      view.dispatch({ effects });
      editor.decoratedDoc = view.state.doc;
    }
    measureConnectorsRef.current();
  }, [
    before,
    after,
    rows,
    highlightMode,
    activeDiffRange,
    beforeLabel,
    afterLabel,
    props.diffRanges,
  ]);

  useLayoutEffect(() => {
    if (!navigationRequest || !propsRef.current.activeDiffRange) return;
    const range = propsRef.current.activeDiffRange;
    for (const side of ["left", "right"] as const) {
      const editor = editorsRef.current[side];
      if (!editor) continue;
      editor.view.requestMeasure({
        read: (view) => {
          const lines = getDiffLineRange(
            propsRef.current.rows,
            side,
            range,
            view.state.doc.lines,
          );
          const blockHeight = (lines.end - lines.start + 1) * DIFF_ROW_HEIGHT;
          const padding =
            blockHeight + 48 <= view.scrollDOM.clientHeight
              ? Math.max((view.scrollDOM.clientHeight - blockHeight) / 2, 24)
              : 24;
          return Math.max((lines.start - 1) * DIFF_ROW_HEIGHT - padding, 0);
        },
        write: (top, view) => {
          if (syncFrameRef.current !== null)
            window.cancelAnimationFrame(syncFrameRef.current);
          syncFrameRef.current = window.requestAnimationFrame(() => {
            syncFrameRef.current = null;
          });
          view.scrollDOM.scrollTop = top;
        },
      });
    }
  }, [navigationRequest]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {errorText ? (
        <div className="rounded-[18px] border border-danger/18 bg-danger/8 px-3.5 py-2.5 text-sm leading-6 text-danger">
          {errorText}
        </div>
      ) : null}
      <div className="grid min-h-0 flex-1 gap-3 lg:gap-0 lg:grid-cols-[minmax(0,1fr)_56px_minmax(0,1fr)]">
        {(["left", "right"] as const).map((side) => (
          <Fragment key={side}>
            <div
              className={`flex min-h-[280px] min-w-0 flex-col overflow-hidden rounded-[24px] border ${toolInsetPanelClassName}`}
            >
              <div className="border-b border-[rgb(var(--color-border)/0.14)] px-3 py-2">
                <div className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted">
                  {side === "left" ? beforeLabel : afterLabel}
                </div>
              </div>
              <div
                ref={side === "left" ? leftHostRef : rightHostRef}
                className="h-96 max-h-[60dvh] min-h-0 flex-none xl:h-auto xl:max-h-none xl:flex-1"
              />
            </div>
            {side === "left" ? (
              <div
                ref={connectorHostRef}
                className="pointer-events-none relative hidden min-h-0 overflow-hidden lg:block"
                aria-hidden="true"
              >
                <svg
                  className="absolute inset-0 h-full w-full overflow-hidden"
                  data-diff-connectors="true"
                >
                  <defs>
                    <clipPath id={connectorClipId}>
                      <rect
                        x="0"
                        y={clip.start}
                        width="56"
                        height={Math.max(clip.end - clip.start, 0)}
                      />
                    </clipPath>
                    <linearGradient id={connectorGradientId}>
                      <stop offset="0%" stopColor="rgb(var(--color-danger))" />
                      <stop
                        offset="100%"
                        stopColor="rgb(var(--color-success))"
                      />
                    </linearGradient>
                  </defs>
                  <g clipPath={`url(#${connectorClipId})`}>
                    {connectors.map(
                      ({ range, left, right, leftBounds, rightBounds }) => {
                        const active = activeDiffRange?.start === range.start;
                        const color =
                          leftBounds.start === leftBounds.end
                            ? "rgb(var(--color-success))"
                            : rightBounds.start === rightBounds.end
                              ? "rgb(var(--color-danger))"
                              : `url(#${connectorGradientId})`;
                        return (
                          <path
                            key={range.start}
                            data-diff-start={range.start}
                            data-left-start={leftBounds.start}
                            data-left-end={leftBounds.end}
                            data-right-start={rightBounds.start}
                            data-right-end={rightBounds.end}
                            d={`M 0 ${left.start} C 28 ${left.start} 28 ${right.start} 56 ${right.start} L 56 ${right.end} C 28 ${right.end} 28 ${left.end} 0 ${left.end} Z`}
                            fill={color}
                            fillOpacity={active ? 0.18 : 0.1}
                            stroke={active ? "rgb(var(--color-accent))" : color}
                            strokeOpacity={active ? 0.7 : 0.3}
                            strokeWidth="1"
                          />
                        );
                      },
                    )}
                  </g>
                </svg>
              </div>
            ) : null}
          </Fragment>
        ))}
      </div>
    </div>
  );
};
