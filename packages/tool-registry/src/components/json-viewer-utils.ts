import type { JsonValue } from "@z-dev-toolbox/core";

const isJsonObject = (
  value: JsonValue,
): value is { [key: string]: JsonValue } =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const collectJsonCollapsiblePaths = (
  value: JsonValue,
  path = "$",
): string[] => {
  if (Array.isArray(value)) {
    const nested = value.flatMap((item, index) =>
      collectJsonCollapsiblePaths(item, `${path}[${index}]`),
    );

    return value.length > 0 ? [path, ...nested] : nested;
  }

  if (!isJsonObject(value)) {
    return [];
  }

  const nested = Object.entries(value).flatMap(([key, item]) =>
    collectJsonCollapsiblePaths(item, `${path}.${key}`),
  );

  return Object.keys(value).length > 0 ? [path, ...nested] : nested;
};
