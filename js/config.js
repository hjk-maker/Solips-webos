/* ── BRAND CONFIG ──
   Change the name of this OS in exactly one place: OS_NAME below.
   Every user-facing label (page title, boot screen, taskbar, terminal
   banner, About panel, AI system prompt) reads from this constant instead
   of a hardcoded string.

   What deliberately does NOT depend on this constant: internal storage
   keys (localStorage, IndexedDB, BroadcastChannel names) and the global
   window._OS / window.OS API objects. Those stay brand-agnostic on purpose
   — if you rename OS_NAME next month, nobody's saved files, settings, or
   custom apps disappear because a storage key changed underneath them.
*/
const OS_NAME = 'Solips-webos';
const OS_TAGLINE = 'A web OS with an AI kernel';
