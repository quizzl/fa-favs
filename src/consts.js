export const TOTAL_RATE_LIMIT = 2E3; // limit the total update loop rate (ms)
export const PER_USER_POST_LIMIT = 1000; // limit num posts per user for space
export const PAGE_LIMIT = 2; // max # pages to search for catchup
export const SETTINGS_KEY_PREFIX = "__FAF_SETTINGS";
export const UI_PAGE_SIZE = 48; // page size for this UI, match FA to curb rate limiting
export const SORTBY = {
	NEW: { value: 'NEW', pretty: 'Newest first' },
	UNVIEWED: { value: 'UNVIEWED', pretty: 'Unviewed first' }
};
export const THEME = {
	DARK: { value: 'DARK', stylesheet: 'dark.css', pretty: 'Dark mode', next: 'LIGHT' },
	LIGHT: { value: 'LIGHT',stylesheet: 'light.css', pretty: 'Light mode', next: 'DARK' }
}
export const ERR_TIMEOUT = 3E3;