/**
 * @fileoverview Main Application Component
 *
 * Root component orchestrating the application shell, navigation, authentication,
 * and lazy-loaded page content with smooth transitions.
 *
 * Key responsibilities:
 * - Authentication flow and session management
 * - Tab-based navigation with animated transitions
 * - Lazy loading of heavy components (TimesheetGrid, Archive, Settings)
 * - Auto-update handling with progress tracking
 * - On-demand data loading per tab to optimize startup performance
 *
 * Architecture decisions:
 * - Lazy loading with Suspense to reduce initial bundle size
 * - On-demand data fetching when tabs activate (not on mount) for performance
 * - Accessibility fix for background blur when dialogs open (prevents focus traps)
 * - Real-time row saves eliminate need for batch save on tab change
 */

import { useState, useEffect, Suspense, lazy, useRef } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import LinearProgress from "@mui/material/LinearProgress";
const Archive = lazy(() => import("./components/archive/DatabaseViewer"));
const TimesheetGrid = lazy(
  () => import("./components/timesheet/TimesheetGrid")
);
import type { TimesheetGridHandle } from "./components/timesheet/TimesheetGrid";
import Navigation from "./components/Navigation";
const Settings = lazy(() => import("./components/Settings"));
import TimesheetSkeleton from "./components/skeletons/TimesheetSkeleton";
import ArchiveSkeleton from "./components/skeletons/ArchiveSkeleton";
import SettingsSkeleton from "./components/skeletons/SettingsSkeleton";
import UpdateDialog from "./components/UpdateDialog";
import LoginDialog from "./components/LoginDialog";
import { DataProvider, useData } from "./contexts/DataContext";
import { SessionProvider, useSession } from "./contexts/SessionContext";
import { initializeTheme } from "./utils/theme-manager";
import logoImage from "./assets/images/logo.svg";
import { APP_VERSION } from "@sheetpilot/shared";
import "./styles/App.css";
import "./styles/transitions.css";
import {
  onDownloadProgress,
  onUpdateAvailable,
  onUpdateDownloaded,
  removeAllUpdateListeners,
} from "./services/ipc/updates";
import { logDebug, logInfo, logUserAction } from "./services/ipc/logger";

/**
 * About dialog content component
 *
 * Displays application branding, version, and author information.
 * Used in both splash screen and settings about dialog.
 *
 * @returns About content with logo, version, and description
 */
export function AboutBody() {
  return (
    <Box className="about-dialog-content">
      <img
        src={logoImage}
        alt="SheetPilot Logo"
        className="about-dialog-logo"
      />
      <Typography variant="body1" color="text.secondary" gutterBottom>
        Version {APP_VERSION}
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Created by Andrew Hughes
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        className="about-dialog-description"
      >
        Automate timesheet data entry into web forms
      </Typography>
    </Box>
  );
}

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

/**
 * Main application content after authentication
 *
 * Orchestrates the entire application UI including:
 * - Tab-based navigation (Timesheet, Archive, Settings)
 * - Lazy-loaded page content with loading skeletons
 * - Animated page transitions
 * - Update progress dialogs
 * - On-demand data loading per tab
 *
 * State management:
 * - Prevents duplicate data fetches during React StrictMode
 * - Handles empty data refresh edge cases
 * - Manages transition animations to prevent UI glitches
 *
 * Accessibility:
 * - Implements workaround for MUI dialog focus trap issue
 * - Monitors aria-hidden changes to blur background content
 *
 * @returns Authenticated application shell with navigation and content
 */
function AppContent() {
  const {
    isLoggedIn,
    isLoading: sessionLoading,
    login: sessionLogin,
  } = useSession();
  const [activeTab, setActiveTab] = useState(0);
  const [displayedTab, setDisplayedTab] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const hasRequestedInitialTimesheetRef = useRef(false);
  const hasRefreshedEmptyOnceRef = useRef(false);
  const hasRequestedArchiveRef = useRef(false);
  const timesheetGridRef = useRef<TimesheetGridHandle>(null);

  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [updateVersion, setUpdateVersion] = useState<string>("");
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateStatus, setUpdateStatus] = useState<
    "downloading" | "installing"
  >("downloading");

  const {
    refreshTimesheetDraft,
    refreshArchiveData,
    isTimesheetDraftLoading,
    timesheetDraftData,
  } = useData();

  // Separate effect for timesheet tab initialization and empty check
  useEffect(() => {
    if (!isLoggedIn || activeTab !== 0) return;

    if (!hasRequestedInitialTimesheetRef.current) {
      window.logger?.debug(
        "[App] Refreshing timesheet draft on initial tab activate"
      );
      hasRequestedInitialTimesheetRef.current = true;
      void refreshTimesheetDraft();
      return;
    }

    // Only check for empty rows if we're done loading
    if (isTimesheetDraftLoading) return;

    const hasRealRows =
      Array.isArray(timesheetDraftData) &&
      timesheetDraftData.some((r) => {
        const row = r as Record<string, unknown>;
        return Boolean(
          row["date"] ||
            row["hours"] !== undefined ||
            row["project"] ||
            row["taskDescription"]
        );
      });

    if (!hasRealRows && !hasRefreshedEmptyOnceRef.current) {
      window.logger?.debug(
        "[App] Timesheet appears empty post-init; refreshing once"
      );
      hasRefreshedEmptyOnceRef.current = true;
      void refreshTimesheetDraft();
    }
  }, [
    activeTab,
    isLoggedIn,
    isTimesheetDraftLoading,
    refreshTimesheetDraft,
    timesheetDraftData,
  ]);

  // Separate effect for archive tab initialization
  useEffect(() => {
    if (!isLoggedIn || activeTab !== 1) return;

    if (!hasRequestedArchiveRef.current) {
      window.logger?.debug("[App] Loading archive data on tab activate");
      hasRequestedArchiveRef.current = true;
      void refreshArchiveData();
    }
  }, [activeTab, isLoggedIn, refreshArchiveData]);

  useEffect(() => {
    initializeTheme();
  }, []);
  useEffect(() => {
    const rootElement = document.getElementById("root");
    if (!rootElement) return;

    const handleAriaHiddenChange = () => {
      const isHidden = rootElement.getAttribute("aria-hidden") === "true";
      if (isHidden) {
        setTimeout(() => {
          const activeElement = document.activeElement;
          if (
            activeElement &&
            rootElement.contains(activeElement) &&
            activeElement !== document.body
          ) {
            (activeElement as HTMLElement).blur();
          }
        }, 0);
      }
    };

    const observer = new MutationObserver(handleAriaHiddenChange);

    observer.observe(rootElement, {
      attributes: true,
      attributeFilter: ["aria-hidden"],
    });

    handleAriaHiddenChange();

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!window.updates) {
      return;
    }

    onUpdateAvailable((version) => {
      logInfo("Update available event received", { version });
      setUpdateVersion(version);
      setUpdateStatus("downloading");
      setShowUpdateDialog(true);
    });

    onDownloadProgress((progress) => {
      logDebug("Download progress", { percent: progress.percent });
      setUpdateProgress(progress.percent);
    });

    onUpdateDownloaded((version) => {
      logInfo("Update downloaded event received", { version });
      setUpdateStatus("installing");
    });

    return () => {
      removeAllUpdateListeners();
    };
  }, []);

  return (
    <div className="app-container">
      <Navigation
        activeTab={activeTab}
        onTabChange={async (newTab) => {
          if (isTransitioning || newTab === activeTab) return;

          logUserAction("tab-change", { from: activeTab, to: newTab });

          setIsTransitioning(true);

          await new Promise((resolve) => setTimeout(resolve, 200));

          setActiveTab(newTab);
          setDisplayedTab(newTab);

          await new Promise((resolve) => setTimeout(resolve, 100));
          setIsTransitioning(false);
        }}
      />

      <div className="main-content-area">
        <div className="content-area">
          {sessionLoading ? (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "100vh",
              }}
            >
              <CircularProgress />
            </Box>
          ) : !isLoggedIn ? (
            <LoginDialog open={!isLoggedIn} onLoginSuccess={sessionLogin} />
          ) : (
            <div
              className={`page-transition-container ${
                isTransitioning ? "page-exit-active" : "page-enter-active"
              }`}
            >
              {displayedTab === 0 && (
                <Suspense fallback={<TimesheetSkeleton />}>
                  <TimesheetGrid ref={timesheetGridRef} />
                </Suspense>
              )}

              {displayedTab === 1 && (
                <Suspense fallback={<ArchiveSkeleton />}>
                  <Archive />
                </Suspense>
              )}

              {displayedTab === 2 && (
                <Suspense fallback={<SettingsSkeleton />}>
                  <Settings />
                </Suspense>
              )}
            </div>
          )}
        </div>

        <UpdateDialog
          open={showUpdateDialog}
          version={updateVersion}
          progress={updateProgress}
          status={updateStatus}
        />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <DataProvider>
        <AppContent />
      </DataProvider>
    </SessionProvider>
  );
}
