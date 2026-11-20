import { useCallback, useEffect, useState } from "react";

import type { PlatformBridge } from "@z-dev-toolbox/platform";

import type { ToolPanelNotification } from "../types";
import type { ToolFeedback } from "./tool-panel-kit";

interface UseToolFeedbackOptions {
  autoCopyOnSuccess: boolean;
  bridge: PlatformBridge;
  copiedText: string;
  copyFailedText: string;
  notify: (notification: ToolPanelNotification) => void;
}

export const useToolFeedback = ({
  autoCopyOnSuccess,
  bridge,
  copiedText,
  copyFailedText,
  notify,
}: UseToolFeedbackOptions) => {
  const [feedback, setFeedback] = useState<ToolFeedback | null>(null);

  useEffect(() => {
    if (feedback) {
      notify(feedback);
    }
  }, [feedback, notify]);

  const copyText = useCallback(
    async (
      value: string,
      successText = copiedText,
      isCurrent?: () => boolean,
    ) => {
      try {
        await bridge.copyText(value);
        if (isCurrent && !isCurrent()) return true;
        setFeedback({
          tone: "success",
          text: successText,
        });
        return true;
      } catch (error) {
        if (isCurrent && !isCurrent()) return false;
        setFeedback({
          tone: "error",
          text: `${copyFailedText}: ${error instanceof Error ? error.message : ""}`.trim(),
        });
        return false;
      }
    },
    [bridge, copiedText, copyFailedText],
  );

  const reportSuccess = useCallback(
    (successText: string, valueToCopy?: string, isCurrent?: () => boolean) => {
      if (!autoCopyOnSuccess || !valueToCopy) {
        setFeedback({
          tone: "success",
          text: successText,
        });
        return;
      }

      void copyText(valueToCopy, `${successText} · ${copiedText}`, isCurrent);
    },
    [autoCopyOnSuccess, copiedText, copyText],
  );

  return {
    feedback,
    setFeedback,
    copyText,
    reportSuccess,
  };
};
