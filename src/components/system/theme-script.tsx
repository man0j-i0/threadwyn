/**
 * Runs before first paint so the correct theme class is on <html> when the
 * browser computes styles. Without this you get a flash of the wrong theme —
 * which on a cream-and-charcoal palette is genuinely jarring.
 */
const script = `(function(){try{var s=localStorage.getItem("threadwyn-theme");var m=window.matchMedia("(prefers-color-scheme: dark)").matches;if(s==="dark"||(s!=="light"&&m)){document.documentElement.classList.add("dark")}}catch(e){}})()`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} suppressHydrationWarning />;
}
