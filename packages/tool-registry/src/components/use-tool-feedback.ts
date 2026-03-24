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
  notify
}: UseToolFeedbackOptions) => {
  const [feedback, setFeedback] = useState<ToolFeedback | null>(null);

  useEffect(() => {
    if (feedback) {
      notify(feedback);
    }
  }, [feedback, notify]);

  const copyText = useCallback(
    async (value: string, successText = copiedText) => {
      try {
        await bridge.copyText(value);
        setFeedback({
          tone: "success",
          text: successText
        });
        return true;
      } catch (error) {
        setFeedback({
          tone: "error",
          text: `${copyFailedText}: ${error instanceof Error ? error.message : ""}`.trim()
        });
        return false;
      }
    },
    [bridge, copiedText, copyFailedText],
  );

  const reportSuccess = useCallback(
    (successText: string, valueToCopy?: string) => {
      if (!autoCopyOnSuccess || !valueToCopy) {
        setFeedback({
          tone: "success",
          text: successText
        });
        return;
      }

      void copyText(valueToCopy, `${successText} · ${copiedText}`);
    },
    [autoCopyOnSuccess, copiedText, copyText],
  );

  return {
    feedback,
    setFeedback,
    copyText,
    reportSuccess
  };
};
