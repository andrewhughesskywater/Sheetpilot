/**
 * @fileoverview Shared types for Settings component
 */

export type StoredCredential = {
  id: number;
  service: string;
  email: string;
  created_at: string;
  updated_at: string;
};

export type FeatureCardProps = {
  title: string;
  className?: string;
  onActivate: () => void;
};

export type SettingsCardsGridProps = {
  isAdmin: boolean;
  onOpenLogs: () => void;
  onOpenUpdateCredentials: () => void;
  onOpenUserGuide: () => void;
  onOpenSettings: () => void;
  onOpenAbout: () => void;
  onLogout: () => void;
  onOpenAdminTools: () => void;
};

export type ExportLogsDialogProps = {
  open: boolean;
  error: string;
  logFiles: string[];
  isExporting: boolean;
  isLoading: boolean;
  onClose: () => void;
  onExport: () => void;
};

export type UserGuideDialogProps = {
  open: boolean;
  onClose: () => void;
};

export type AdminToolsDialogProps = {
  open: boolean;
  error: string;
  isAdminActionLoading: boolean;
  onClose: () => void;
  onRequestClearCredentials: () => void;
  onRequestRebuildDatabase: () => void;
};

export type UpdateCredentialsDialogProps = {
  open: boolean;
  storedCredentials: StoredCredential[];
  updateEmail: string;
  updatePassword: string;
  isUpdatingCredentials: boolean;
  onClose: () => void;
  onSave: () => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
};

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  severity: 'warning' | 'error';
  confirmLabel: string;
  loadingLabel?: string;
  confirmColor?: 'inherit' | 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';
  isLoading: boolean;
  onClose: () => void;
  onConfirm: () => void;
  children: React.ReactNode;
};

export type ApplicationSettingsDialogProps = {
  open: boolean;
  error: string;
  headlessMode: boolean;
  isLoadingSettings: boolean;
  onClose: () => void;
  onHeadlessModeToggle: (checked: boolean) => void;
};

export type AboutDialogProps = {
  open: boolean;
  onClose: () => void;
};
