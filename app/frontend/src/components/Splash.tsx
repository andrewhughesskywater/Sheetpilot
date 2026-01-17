/**
 * @fileoverview Splash Screen Component
 *
 * Displays application branding and update progress during:
 * - Initial app startup
 * - Update download and installation
 * - Update finalization after restart
 */

import { useState, useEffect } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";
import { AboutBody } from "./AboutBody";
import {
  onDownloadProgress,
  onUpdateAvailable,
  onUpdateDownloaded,
  removeAllUpdateListeners,
} from "@/services/ipc/updates";

/**
 * Splash screen component shown during app initialization and updates
 *
 * Displays application branding and update progress during:
 * - Initial app startup
 * - Update download and installation
 * - Update finalization after restart
 *
 * Update flow:
 * 1. Checking - Looking for available updates
 * 2. Downloading - Downloading update with progress bar
 * 3. Installing - Preparing update for installation
 * 4. Finalizing - Post-restart update completion (detected via URL hash)
 * 5. Ready - Proceeding to main app
 *
 * @returns Splash screen with progress indicator
 */
export function Splash() {
  const [progress, setProgress] = useState<number | null>(null);
  const [status, setStatus] = useState<
    "checking" | "downloading" | "installing" | "finalizing" | "ready"
  >(() => {
    // Detect finalize state from URL hash to show appropriate message after app restart
    const hash = window.location.hash || "";
    return hash.includes("state=finalize") ? "finalizing" : "checking";
  });

  useEffect(() => {
    const transitionToApp = () => {
      setStatus("ready");
      // Remove splash hash to transition to main app
      if (window.location.hash.includes("splash")) {
        window.history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search
        );
        // Trigger hashchange event to update ThemedApp component
        window.dispatchEvent(new Event("hashchange"));
      }
    };

    if (!window.updates) {
      // If updates API is not available, transition to main app after a brief delay
      const timer = setTimeout(transitionToApp, 1000);
      return () => clearTimeout(timer);
    }

    onUpdateAvailable((_version) => {
      setStatus("downloading");
    });
    onDownloadProgress((p) => {
      setStatus("downloading");
      setProgress(p.percent);
    });
    onUpdateDownloaded((_version) => {
      setStatus("installing");
    });

    // After checking for updates (or if no updates available), transition to main app
    const checkTimer = setTimeout(() => {
      if (status === "checking") {
        transitionToApp();
      }
    }, 1500);

    return () => {
      clearTimeout(checkTimer);
      removeAllUpdateListeners();
    };
  }, [status]);

  const renderStatus = () => {
    switch (status) {
      case "checking":
        return "Checking for updates…";
      case "downloading":
        return progress != null
          ? `Downloading update… ${progress.toFixed(0)}%`
          : "Downloading update…";
      case "installing":
        return "Installing update…";
      case "finalizing":
        return "Finalizing update…";
      case "ready":
        return "Starting…";
      default:
        return "";
    }
  };

  return (
    <Box className="splash-container" sx={{ gap: "var(--sp-space-4)" }}>
      <AboutBody />
      <Box sx={{ width: "60%", minWidth: 260, maxWidth: 400 }}>
        <LinearProgress
          variant={progress != null ? "determinate" : "indeterminate"}
          {...(progress != null ? { value: progress } : {})}
          sx={{
            height: 8,
            borderRadius: "var(--sp-radius-sm)",
            backgroundColor: "var(--md-sys-color-surface-variant)",
            "& .MuiLinearProgress-bar": {
              backgroundColor: "var(--md-sys-color-primary)",
            },
          }}
        />
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 1, textAlign: "center" }}
        >
          {renderStatus()}
        </Typography>
      </Box>
    </Box>
  );
}
