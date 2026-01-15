// Define a type that matches Handsontable's internal CellChange tuple structure
// [row, prop, oldValue, newValue]
// prop can be string, number, or function (though we only use string/number)
export type HandsontableChange = [
  number,
  string | number | unknown,
  unknown,
  unknown,
];
