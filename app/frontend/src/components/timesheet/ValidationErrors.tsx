/**
 * ValidationErrors Component
 * 
 * Displays validation errors above the submit button using MUI components.
 * Shows up to 3 individual errors, or a summary button for more.
 */

import { Alert, Button, Box, Chip } from '@mui/material';
import { Error as ErrorIcon } from '@mui/icons-material';

interface ValidationError {
  row: number;
  col: number;
  field: string;
  message: string;
}

export interface ValidationErrorsProps {
  errors: ValidationError[];
  onShowAllErrors: () => void;
}

export function ValidationErrors({ errors, onShowAllErrors }: ValidationErrorsProps) {
  if (errors.length === 0) {
    return null;
  }

  const MAX_VISIBLE_ERRORS = 3;
  const visibleErrors = errors.slice(0, MAX_VISIBLE_ERRORS);
  const hasMoreErrors = errors.length > MAX_VISIBLE_ERRORS;

  return (
    <Box sx={{ width: '100%', mb: 2 }}>
      {!hasMoreErrors && visibleErrors.map((error, index) => (
        <Alert 
          key={`${error.row}-${error.col}-${index}`} 
          severity="error" 
          icon={<ErrorIcon />}
          sx={{ mb: 1 }}
        >
          Row {error.row + 1}: {error.message}
        </Alert>
      ))}
      
      {hasMoreErrors && (
        <Alert 
          severity="error" 
          action={
            <Button 
              color="inherit" 
              size="small" 
              onClick={onShowAllErrors}
            >
              View All
            </Button>
          }
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <span>Multiple validation errors found</span>
            <Chip 
              label={errors.length} 
              size="small" 
              color="error" 
              sx={{ fontWeight: 'bold' }}
            />
          </Box>
        </Alert>
      )}
    </Box>
  );
}

