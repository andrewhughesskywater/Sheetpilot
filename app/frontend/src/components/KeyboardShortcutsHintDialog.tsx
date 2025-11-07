import { useState, useCallback, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, FormControlLabel, Checkbox, Button } from '@mui/material';
import './KeyboardShortcutsHintDialog.css';

interface KeyboardShortcutsHintDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutsHintDialog({ open, onClose }: KeyboardShortcutsHintDialogProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const totalPages = 2;

  // Check if we should show the hint based on 3-day logic
  useEffect(() => {
    if (!open) return;

    const dontShowAgainFlag = localStorage.getItem('sheetpilot-hide-shortcuts-hint');
    if (dontShowAgainFlag === 'true') {
      onClose();
      return;
    }

    const lastShownStr = localStorage.getItem('sheetpilot-shortcuts-hint-last-shown');
    const now = Date.now();
    
    if (!lastShownStr) {
      // First time - save the timestamp
      localStorage.setItem('sheetpilot-shortcuts-hint-last-shown', now.toString());
    } else {
      const lastShown = parseInt(lastShownStr, 10);
      const threeDaysInMs = 3 * 24 * 60 * 60 * 1000;
      
      if (now - lastShown < threeDaysInMs) {
        // Less than 3 days - don't show (unless it's the forced demo mode)
        // onClose();
        // return;
      } else {
        // More than 3 days - update timestamp
        localStorage.setItem('sheetpilot-shortcuts-hint-last-shown', now.toString());
      }
    }
  }, [open, onClose]);

  const handleClose = useCallback(() => {
    if (dontShowAgain) {
      localStorage.setItem('sheetpilot-hide-shortcuts-hint', 'true');
    }
    setCurrentPage(0); // Reset to first page
    setDontShowAgain(false); // Reset checkbox
    onClose();
  }, [dontShowAgain, onClose]);

  const handleNext = useCallback(() => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  }, [currentPage]);

  const handleBack = useCallback(() => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  }, [currentPage]);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      className="shortcuts-hint-dialog"
      PaperProps={{
        sx: {
          backgroundColor: 'var(--md-sys-color-surface-container-high)',
          color: 'var(--md-sys-color-on-surface)',
          borderRadius: 'var(--md-sys-shape-corner-large)',
        }
      }}
    >
      <DialogTitle
        sx={{
          fontFamily: 'var(--md-sys-typescale-headline-small-font)',
          fontSize: 'var(--md-sys-typescale-headline-small-size)',
          fontWeight: 'var(--md-sys-typescale-headline-small-weight)',
          color: 'var(--md-sys-color-on-surface)',
          paddingBottom: 'var(--sp-space-2)',
        }}
      >
        Helpful Hints
      </DialogTitle>
      
      <DialogContent className="shortcuts-hint-content">
        {currentPage === 0 && (
          <div className="hint-page">
            <p className="hint-story">
              Save time and speed through your timesheet! These date shortcuts help you quickly fill in entries 
              without reaching for your mouse. Perfect for when you're entering multiple days in a row.
            </p>
            <div className="shortcuts-section">
              <strong>Date Entry Shortcuts:</strong>
              <ul>
                <li><strong>Tab</strong> - Accept the smart date placeholder</li>
                <li><strong>Shift+Tab</strong> - Insert day after the placeholder</li>
                <li><strong>Ctrl+Tab</strong> - Insert day after your last entry</li>
                <li><strong>Ctrl+T</strong> - Insert today's date</li>
              </ul>
            </div>
          </div>
        )}
        
        {currentPage === 1 && (
          <div className="hint-page">
            <p className="hint-story">
              Work smarter, not harder! Use these shortcuts to duplicate rows and apply saved macros. 
              They're especially handy when you have repetitive entries or common task patterns.
            </p>
            <div className="shortcuts-section">
              <strong>Other Shortcuts:</strong>
              <ul>
                <li><strong>Ctrl+D</strong> - Duplicate selected row</li>
                <li><strong>Ctrl+1 through Ctrl+5</strong> - Apply saved macros</li>
              </ul>
            </div>
          </div>
        )}

        <div className="page-indicator">
          {Array.from({ length: totalPages }, (_, i) => (
            <span key={i} className={`page-dot ${i === currentPage ? 'active' : ''}`} />
          ))}
        </div>
      </DialogContent>
      
      <DialogActions
        sx={{
          padding: 'var(--sp-space-3)',
          paddingTop: 'var(--sp-space-2)',
          justifyContent: 'space-between',
        }}
      >
        <FormControlLabel
          control={
            <Checkbox
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              sx={{
                color: 'var(--md-sys-color-on-surface-variant)',
                '&.Mui-checked': {
                  color: 'var(--md-sys-color-primary)',
                },
              }}
            />
          }
          label="Don't show again"
          sx={{ 
            color: 'var(--md-sys-color-on-surface-variant)',
            fontFamily: 'var(--md-sys-typescale-body-medium-font)',
            fontSize: 'var(--md-sys-typescale-body-medium-size)',
          }}
        />
        
        <div className="navigation-buttons">
          {currentPage > 0 && (
            <Button 
              onClick={handleBack}
              variant="text"
              sx={{
                color: 'var(--md-sys-color-primary)',
                textTransform: 'none',
                fontFamily: 'var(--md-sys-typescale-label-large-font)',
                fontSize: 'var(--md-sys-typescale-label-large-size)',
                fontWeight: 'var(--md-sys-typescale-label-large-weight)',
                marginRight: 'var(--sp-space-2)',
              }}
            >
              Back
            </Button>
          )}
          
          {currentPage < totalPages - 1 ? (
            <Button 
              onClick={handleNext}
              variant="contained"
              sx={{
                backgroundColor: 'var(--md-sys-color-primary)',
                color: 'var(--md-sys-color-on-primary)',
                borderRadius: 'var(--md-sys-shape-corner-full)',
                textTransform: 'none',
                fontFamily: 'var(--md-sys-typescale-label-large-font)',
                fontSize: 'var(--md-sys-typescale-label-large-size)',
                fontWeight: 'var(--md-sys-typescale-label-large-weight)',
                '&:hover': {
                  backgroundColor: 'var(--md-sys-color-primary-container)',
                  color: 'var(--md-sys-color-on-primary-container)',
                },
              }}
            >
              Next
            </Button>
          ) : (
            <Button 
              onClick={handleClose}
              variant="contained"
              sx={{
                backgroundColor: 'var(--md-sys-color-primary)',
                color: 'var(--md-sys-color-on-primary)',
                borderRadius: 'var(--md-sys-shape-corner-full)',
                textTransform: 'none',
                fontFamily: 'var(--md-sys-typescale-label-large-font)',
                fontSize: 'var(--md-sys-typescale-label-large-size)',
                fontWeight: 'var(--md-sys-typescale-label-large-weight)',
                '&:hover': {
                  backgroundColor: 'var(--md-sys-color-primary-container)',
                  color: 'var(--md-sys-color-on-primary-container)',
                },
              }}
            >
              Got it
            </Button>
          )}
        </div>
      </DialogActions>
    </Dialog>
  );
}

