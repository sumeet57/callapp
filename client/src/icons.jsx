const I = ({ children, size = 26, ...p }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...p}
  >
    {children}
  </svg>
);

const phonePath =
  'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z';

export const Mic = (p) => (
  <I {...p}>
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
  </I>
);
export const MicOff = (p) => (
  <I {...p}>
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="2" y1="2" x2="22" y2="22" />
  </I>
);
export const Speaker = (p) => (
  <I {...p}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </I>
);
export const Handset = (p) => (
  <I {...p}>
    <path d={phonePath} />
  </I>
);
export const EndCall = (p) => (
  <I {...p}>
    <g transform="rotate(135 12 12)">
      <path d={phonePath} />
    </g>
  </I>
);
// Push-to-talk mode icon (walkie-talkie)
export const Walkie = (p) => (
  <I {...p}>
    <rect x="7" y="8" width="10" height="14" rx="2" />
    <line x1="10" y1="2" x2="10" y2="8" />
    <line x1="10" y1="12" x2="14" y2="12" />
    <line x1="10" y1="15" x2="14" y2="15" />
    <line x1="10" y1="18" x2="14" y2="18" />
  </I>
);
// Continuous / open mic mode icon (live waveform)
export const Wave = (p) => (
  <I {...p}>
    <path d="M4 10v4M8 6v12M12 3v18M16 8v8M20 11v2" />
  </I>
);
export const Shuffle = (p) => (
  <I {...p}>
    <polyline points="16 3 21 3 21 8" />
    <line x1="4" y1="20" x2="21" y2="3" />
    <polyline points="21 16 21 21 16 21" />
    <line x1="15" y1="15" x2="21" y2="21" />
    <line x1="4" y1="4" x2="9" y2="9" />
  </I>
);
export const Bell = (p) => (
  <I {...p}>
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </I>
);
export const Share = (p) => (
  <I {...p}>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </I>
);
