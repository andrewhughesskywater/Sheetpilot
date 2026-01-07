import Button from '@mui/material/Button';
import EditIcon from '@mui/icons-material/Edit';
import type { MacroRow } from '../../../utils/macroStorage';
import { isMacroEmpty } from '../../../utils/macroStorage';

interface MacroToolbarProps {
  macros: MacroRow[];
  onApplyMacro: (index: number) => void;
  onOpenManager: () => void;
}

export function MacroToolbar({ macros, onApplyMacro, onOpenManager }: MacroToolbarProps) {
  return (
    <div className="macro-toolbar">
      {macros.map((macro, index) => {
        const empty = isMacroEmpty(macro);
        const displayName = macro.name?.trim() || `Macro ${index + 1}`;
        const label = empty ? `Macro ${index + 1}` : displayName.length > 30 ? `${displayName.slice(0, 30)}...` : displayName;
        const tooltipText = empty ? `Macro ${index + 1} not configured` : `${displayName}${macro.taskDescription ? ` - ${macro.taskDescription}` : ''}`;
        return (
          <Button
            key={index}
            className="macro-button"
            variant="outlined"
            size="small"
            disabled={empty}
            onClick={() => onApplyMacro(index)}
            title={tooltipText}
          >
            <span className="macro-button-label">
              {label}
              <span className="macro-button-shortcut">Ctrl+{index + 1}</span>
            </span>
          </Button>
        );
      })}
      <Button className="macro-edit-button" variant="text" size="small" startIcon={<EditIcon />} onClick={onOpenManager}>
        Edit Macros...
      </Button>
    </div>
  );
}
