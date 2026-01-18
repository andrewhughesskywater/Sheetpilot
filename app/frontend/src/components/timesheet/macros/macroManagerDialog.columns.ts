/**
 * Column definitions for macro manager dialog
 * Database is the single source of truth - projects and chargeCodes must be provided.
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
    {
      data: "name",
      title: "Macro Name",
      type: "text",
      placeholder: "Name your macro",
      className: "htLeft",
    },
    {
      data: "hours",
      title: "Hours",
      type: "numeric",
      placeholder: "1.25, 1.5, 2.0",
      className: "htCenter",
      width: 80,
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
      trimDropdown: false,
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
    },
    {
      data: "taskDescription",
      title: "Task Description",
      editor: "spellcheckText",
      placeholder: "Description",
      className: "htLeft",
      maxLength: 120,
    },
  ];
}
