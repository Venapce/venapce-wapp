// The panel's build identity.
//
// Stamped at build time from the same VERSION the appliance image is released
// under — the product Dockerfile passes it to the Vite build as
// VITE_VENAPCE_VERSION, and the backend binary is stamped from the very same
// value. A plain `pnpm dev` has none and reports "dev".
export const APP_VERSION = import.meta.env.VITE_VENAPCE_VERSION || 'dev'
