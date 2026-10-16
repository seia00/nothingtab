/* Brand marks.
   Google Workspace pages are rebuilt from the official geometry (page + folded
   corner) using the exact brand hexes lifted from Google's own SVGs, so the
   three read as a set. Gmail is Google's official multicolour mark verbatim.
   GitHub / Vercel / Spotify use the canonical single-path silhouettes. */

const gPage = (main, fold, inner) => `
<svg viewBox="0 0 47 65" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path fill="${main}" d="M29.375 0H4.406C1.983 0 0 1.994 0 4.432v56.136C0 63.006 1.983 65 4.406 65h38.188C45.017 65 47 63.006 47 60.568V17.727L29.375 0z"/>
  <path fill="${fold}" d="M29.375 0v13.295c0 2.449 1.972 4.432 4.406 4.432H47L29.375 0z"/>
  ${inner}
</svg>`;

export const ICONS = {
  gmail: `
<svg viewBox="52 42 88 66" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path fill="#4285f4" d="M58 108h14V74L52 59v43c0 3.32 2.69 6 6 6"/>
  <path fill="#34a853" d="M120 108h14c3.32 0 6-2.69 6-6V59l-20 15"/>
  <path fill="#fbbc04" d="M120 48v26l20-15v-8c0-7.42-8.47-11.65-14.4-7.2"/>
  <path fill="#ea4335" d="M72 74V48l24 18 24-18v26L96 92"/>
  <path fill="#c5221f" d="M52 51v8l20 15V48l-5.6-4.2c-5.94-4.45-14.4-.22-14.4 7.2"/>
</svg>`,

  docs: gPage('#4285F4', '#A1C2FA', `
  <g fill="#fff">
    <rect x="11.4" y="26.2" width="24.2" height="2.3" rx="1.15"/>
    <rect x="11.4" y="32.4" width="24.2" height="2.3" rx="1.15"/>
    <rect x="11.4" y="38.6" width="24.2" height="2.3" rx="1.15"/>
    <rect x="11.4" y="44.8" width="16.6" height="2.3" rx="1.15"/>
  </g>`),

  sheets: gPage('#0F9D58', '#87CEAC', `
  <path fill="#fff" d="M10.8 25.8h25.4v25.4H10.8z"/>
  <g stroke="#0F9D58" stroke-width="2.1">
    <path d="M10.8 32.15h25.4M10.8 38.5h25.4M10.8 44.85h25.4M19.27 25.8v25.4M27.73 25.8v25.4"/>
  </g>`),

  slides: gPage('#F4B400', '#FADA80', `
  <rect x="10.2" y="27.4" width="26.6" height="18.6" rx="1.8" fill="#fff"/>`),

  github: `
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path fill="#fff" d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
</svg>`,

  vercel: `
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path fill="#fff" d="M24 22.525H0l12-21.05 12 21.05z"/>
</svg>`,

  spotify: `
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <circle cx="12" cy="12" r="12" fill="#000"/>
  <path fill="#1DB954" d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
</svg>`,

  /* Fallback mark for user-added links whose favicon fails to load. */
  globe: `
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" fill="none"
     stroke="rgba(232,236,245,.75)" stroke-width="1.3">
  <circle cx="12" cy="12" r="9.2"/>
  <path d="M2.8 12h18.4M12 2.8c2.5 2.5 3.8 5.8 3.8 9.2s-1.3 6.7-3.8 9.2c-2.5-2.5-3.8-5.8-3.8-9.2S9.5 5.3 12 2.8z"/>
</svg>`,

  plus: `
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"
     stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
  <path d="M12 6v12M6 12h12"/>
</svg>`,

  /* Suggestion-row marks. */
  query: `
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" fill="none"
     stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
  <circle cx="10.5" cy="10.5" r="6.4"/><path d="M15.2 15.2 20.5 20.5"/>
</svg>`,

  arrow: `
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" fill="none"
     stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
  <path d="M7 17 17 7M8.5 7H17v8.5"/>
</svg>`,
};

/* Weather marks. Drawn rather than typed: the Unicode weather characters are
   emoji-default and Safari colours them in regardless of a text variation
   selector, which fights the monochrome palette. */
const wx = (d) => `
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"
     fill="none" stroke="currentColor" stroke-width="1.45"
     stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

export const WX = {
  clear: wx(`<circle cx="12" cy="12" r="4.1"/>
    <path d="M12 2.7v2.4M12 18.9v2.4M2.7 12h2.4M18.9 12h2.4
             M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7"/>`),
  partly: wx(`<circle cx="8.4" cy="8" r="3"/>
    <path d="M8.4 2.4v1.6M2.8 8h1.6M4.5 4.1l1.1 1.1M12.3 4.1l-1.1 1.1"/>
    <path d="M10.2 20.4h7.4a3.4 3.4 0 0 0 .4-6.75 4.85 4.85 0 0 0-9.25-1.05 3.5 3.5 0 0 0 1.45 7.8z"/>`),
  cloud: wx(`<path d="M7.4 18.6h9.9a3.9 3.9 0 0 0 .5-7.74 5.6 5.6 0 0 0-10.7-1.2 4 4 0 0 0 .3 8.94z"/>`),
  fog: wx(`<path d="M3.4 8.6h17.2M3.4 12.4h12.8M6.6 16.2h14"/>`),
  rain: wx(`<path d="M7.4 15.8h9.9a3.9 3.9 0 0 0 .5-7.74 5.6 5.6 0 0 0-10.7-1.2 4 4 0 0 0 .3 8.94z"/>
    <path d="M9.2 18.4l-1 2.9M13 18.4l-1 2.9M16.8 18.4l-1 2.9"/>`),
  snow: wx(`<path d="M7.4 15.8h9.9a3.9 3.9 0 0 0 .5-7.74 5.6 5.6 0 0 0-10.7-1.2 4 4 0 0 0 .3 8.94z"/>
    <path d="M9.3 19.6h.01M12.6 19.6h.01M15.9 19.6h.01M11 22.1h.01M14.3 22.1h.01"/>`),
  storm: wx(`<path d="M7.4 15.2h9.9a3.9 3.9 0 0 0 .5-7.74 5.6 5.6 0 0 0-10.7-1.2 4 4 0 0 0 .3 8.94z"/>
    <path d="M13.1 17.4l-3 4.1h3.1l-1.3 3"/>`),
  none: wx(`<path d="M4 12h16"/>`),
};
