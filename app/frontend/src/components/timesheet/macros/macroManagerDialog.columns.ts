import { PROJECTS, CHARGE_CODES } from "@sheetpilot/shared/business-config";

// Column definitions
export const columnDefinitions = [
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
    source: [...PROJECTS],
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
    source: [...CHARGE_CODES],
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
