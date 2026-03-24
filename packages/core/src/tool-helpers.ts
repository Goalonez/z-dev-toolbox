import type { ToolExecutionError, ToolResult } from "@z-dev-toolbox/shared";

export const createToolSuccess = <T>(data: T): ToolResult<T> => ({
  ok: true,
  data
});

export const createToolError = (
  error: ToolExecutionError,
): ToolResult<never> => ({
  ok: false,
  error
});
