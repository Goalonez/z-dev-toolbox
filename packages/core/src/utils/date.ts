const pad = (value: number) => value.toString().padStart(2, "0");
const padMilliseconds = (value: number) => value.toString().padStart(3, "0");

export const formatDateTime = (
  date: Date,
  zone: "local" | "utc",
  includeMilliseconds = false,
) => {
  const year =
    zone === "utc" ? date.getUTCFullYear() : date.getFullYear();
  const month =
    zone === "utc" ? date.getUTCMonth() + 1 : date.getMonth() + 1;
  const day = zone === "utc" ? date.getUTCDate() : date.getDate();
  const hours = zone === "utc" ? date.getUTCHours() : date.getHours();
  const minutes =
    zone === "utc" ? date.getUTCMinutes() : date.getMinutes();
  const seconds =
    zone === "utc" ? date.getUTCSeconds() : date.getSeconds();
  const milliseconds =
    zone === "utc" ? date.getUTCMilliseconds() : date.getMilliseconds();

  return `${year}-${pad(month)}-${pad(day)} ${pad(hours)}:${pad(minutes)}:${pad(seconds)}${
    includeMilliseconds ? `.${padMilliseconds(milliseconds)}` : ""
  }`;
};

export const startOfNextMinute = (timestamp: number) =>
  timestamp - (timestamp % 60_000) + 60_000;

export const startOfNextSecond = (timestamp: number) =>
  timestamp - (timestamp % 1_000) + 1_000;
