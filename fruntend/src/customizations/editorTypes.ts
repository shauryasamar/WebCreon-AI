export type EditorFieldOption = {
  label: string;
  value: string;
};

export type EditorFieldType =
  | "text"
  | "textarea"
  | "select"
  | "color"
  | "number"
  | "checkbox";

export type EditorFieldTarget = "props" | "theme";

export type EditorField = {
  key: string;
  label: string;
  type: EditorFieldType;
  target?: EditorFieldTarget;
  options?: EditorFieldOption[];
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
};

export type EditableBlockConfig = {
  displayName: string;
  fields: EditorField[];
};

export type EditorRegistry = Record<string, EditableBlockConfig>;