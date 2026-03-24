const chromeLike = (
  globalThis as {
    chrome?: {
      action?: {
        onClicked?: {
          addListener: (callback: () => void) => void;
        };
      };
      runtime?: {
        onInstalled?: {
          addListener: (callback: () => void) => void;
        };
        openOptionsPage?: () => Promise<void> | void;
      };
    };
  }
).chrome;

chromeLike?.runtime?.onInstalled?.addListener(() => {
  console.info("Z Dev Toolbox extension installed.");
});

chromeLike?.action?.onClicked?.addListener(() => {
  void chromeLike?.runtime?.openOptionsPage?.();
});
