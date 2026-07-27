interface IconProps {
  name:
    | "midi"
    | "sliders"
    | "presets"
    | "keyboard"
    | "help"
    | "camera"
    | "fullscreen"
    | "eye"
    | "sparkle"
    | "close"
    | "reset";
  size?: number;
}

const paths: Record<IconProps["name"], React.ReactNode> = {
  midi: (
    <>
      <path d="M4 7.5v9M8 6v12M12 9v6M16 6v12M20 7.5v9" />
      <path d="M2.5 5h19v14h-19z" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 6h7M15 6h5M4 12h2M10 12h10M4 18h10M18 18h2" />
      <circle cx="13" cy="6" r="2" />
      <circle cx="8" cy="12" r="2" />
      <circle cx="16" cy="18" r="2" />
    </>
  ),
  presets: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8 8h8M8 12h5M8 16h8" />
    </>
  ),
  keyboard: (
    <>
      <path d="M3 7h18v11H3zM7 7v7M12 7v7M17 7v7" />
      <path d="M5.5 7v5h3V7M10.5 7v5h3V7M15.5 7v5h3V7" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.8 9a2.4 2.4 0 1 1 3.3 2.2c-.8.4-1.1.9-1.1 1.8M12 17h.01" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  fullscreen: (
    <>
      <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  sparkle: (
    <>
      <path d="m12 2 1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5zM19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  reset: (
    <>
      <path d="M4 11a8 8 0 1 1 2.3 6" />
      <path d="M4 5v6h6" />
    </>
  ),
};

export function Icon({ name, size = 18 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
