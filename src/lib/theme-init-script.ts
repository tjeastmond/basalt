/** Inline script run in <head> before paint; keep in sync with {@link THEME_STORAGE_KEY}. */
export const THEME_STORAGE_KEY = "theme";

export const themeInitScript = `(function(){
try{
var k=${JSON.stringify(THEME_STORAGE_KEY)};
var d=document.documentElement;
var t=localStorage.getItem(k);
var resolved;
if(t==="light"||t==="dark")resolved=t;
else resolved=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";
d.classList.remove("light","dark");
d.classList.add(resolved);
d.style.colorScheme=resolved;
}catch(e){}
})();`;
