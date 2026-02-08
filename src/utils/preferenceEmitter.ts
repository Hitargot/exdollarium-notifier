// Small, dependency-free event emitter used for simple cross-component
// notifications of preference changes. This avoids pulling in Node's
// `events` package which may not be present in React Native runtime.

// Deprecated shim: the application now uses PreferencesContext (usePreferences)
// Prefer migrating consumers to `usePreferences()`; this shim logs a warning
// and is a no-op to avoid runtime errors in older code while migration finishes.

function warnOnce(msg: string) {
	if ((globalThis as any).__prefEmitterWarnShown) return;
	try { console.warn(msg); } catch (e) {}
	(globalThis as any).__prefEmitterWarnShown = true;
}

const prefEmitter = {
	on: (_event: string, _handler: (...args: any[]) => void) => {
		warnOnce('prefEmitter is deprecated — use usePreferences() from src/contexts/PreferencesContext');
		return () => {};
	},
	off: (_event: string, _handler?: (...args: any[]) => void) => {
		warnOnce('prefEmitter is deprecated — use usePreferences() from src/contexts/PreferencesContext');
	},
	emit: (_event: string, ..._args: any[]) => {
		warnOnce('prefEmitter is deprecated — use usePreferences() from src/contexts/PreferencesContext');
	}
};

export default prefEmitter;
