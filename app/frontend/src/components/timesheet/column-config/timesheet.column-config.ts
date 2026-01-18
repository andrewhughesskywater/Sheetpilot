/**
 * Column definitions for timesheet grid
 *
 * Column configuration for Handsontable timesheet grid.
 * NO validators (validation happens in afterChange to prevent editor blocking)
 * CRITICAL: ID column must be first and hidden - this is the "Golden Rule" for Handsontable-SQL sync
 *
 * Database is the single source of truth - projects and chargeCodes must be provided.
 */

/**
 * Get column definitions for timesheet grid
 *
 * @param projects - Projects array from database (empty array if not loaded yet)
 * @param chargeCodes - Charge codes array from database (empty array if not loaded yet)
 * @returns Array of column definition objects
 */
export function getColumnDefinitions(
  projects: readonly string[],
  chargeCodes: readonly string[]
) {
  return [
    { data: "id", title: "ID", type: "numeric", width: 0.1, readOnly: true }, // Hidden ID column for row identity
    {
      data: "date",
      title: "Date",
      type: "date",
      dateFormat: "MM/DD/YYYY",
      placeholder: "MM/DD/YYYY",
      className: "htCenter",
    },
    {
      data: "hours",
      title: "Hours",
      type: "numeric",
      placeholder: "0 to 24",
      className: "htCenter",
    },
    {
      data: "project",
      title: "Project",
      type: "dropdown",
      source: [...projects],
      strict: true,
      allowInvalid: false,
      placeholder: "Pick a project",
      className: "htCenter",
      trimDropdown: true,
    },
    {
      data: "tool",
      title: "Tool",
      type: "dropdown",
      source: [],
      strict: true,
      allowInvalid: false,
      placeholder: "",
      className: "htCenter",
      trimDropdown: true,
    },
    {
      data: "chargeCode",
      title: "Charge Code",
      type: "dropdown",
      source: [...chargeCodes],
      strict: true,
      allowInvalid: false,
      placeholder: "",
      className: "htCenter",
      trimDropdown: true,
    },
    {
      data: "taskDescription",
      title: "Task Description",
      editor: "spellcheckText",
      placeholder: "",
      className: "htLeft",
      maxLength: 120,
    },
  ];
}
