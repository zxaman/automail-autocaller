import type { UiIconName } from './ui-icon.model';

/** 24x24 stroke path data, drawn with currentColor. */
export const UI_ICON_PATHS: Readonly<Record<UiIconName, readonly string[]>> = {
  dashboard: ['M4 4h7v7H4z', 'M13 4h7v4h-7z', 'M13 10h7v10h-7z', 'M4 13h7v7H4z'],
  contacts: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M4 20a8 8 0 0 1 16 0'],
  calls: [
    'M6.5 4h3l1.5 4-2 1.5a12 12 0 0 0 5.5 5.5L16 13l4 1.5v3a2 2 0 0 1-2.2 2A16 16 0 0 1 4 6.2 2 2 0 0 1 6.5 4Z',
  ],
  emails: ['M3 6h18v12H3z', 'm3 7 9 6 9-6'],
  templates: ['M5 3h14v18H5z', 'M8 8h8', 'M8 12h8', 'M8 16h5'],
  imports: ['M12 3v11', 'm7 10 5 5 5-5', 'M4 20h16'],
  analytics: ['M4 20V10', 'M10 20V4', 'M16 20v-7', 'M22 20H2'],
  settings: [
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
    'M19.4 13a7.6 7.6 0 0 0 0-2l2-1.4-2-3.4-2.3 1a7.6 7.6 0 0 0-1.8-1L14.9 3H9.1l-.4 2.4a7.6 7.6 0 0 0-1.8 1l-2.3-1-2 3.4L4.6 11a7.6 7.6 0 0 0 0 2l-2 1.4 2 3.4 2.3-1c.55.42 1.16.76 1.8 1L9.1 21h5.8l.4-2.4c.64-.24 1.25-.58 1.8-1l2.3 1 2-3.4Z',
  ],
  menu: ['M4 7h16', 'M4 12h16', 'M4 17h16'],
  close: ['M6 6l12 12', 'M18 6 6 18'],
  search: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z', 'm20 20-4-4'],
  logout: ['M15 12H4', 'm8 8-4 4 4 4', 'M12 4h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6'],
  plus: ['M12 5v14', 'M5 12h14'],
  alert: ['M12 4 2.5 20h19L12 4Z', 'M12 10v4', 'M12 17h.01'],
  inbox: ['M3 13h5l1.5 3h5L16 13h5', 'M5 5h14l2 8v6H3v-6l2-8Z'],
  check: ['m5 13 4 4 10-10'],
  'chevron-left': ['m14 6-6 6 6 6'],
};
