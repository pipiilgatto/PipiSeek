import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function IconBase({ children, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export function CatMark(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5.5 10.2 4.6 4.7l4.7 2.2a8.1 8.1 0 0 1 5.4 0l4.7-2.2-.9 5.5a7.4 7.4 0 0 1 .5 2.7c0 4.2-3.1 7.1-7 7.1s-7-2.9-7-7.1c0-1 .2-1.9.5-2.7Z" />
      <path d="M8.6 13.3h.01M15.4 13.3h.01M10.5 16c.8.7 2.2.7 3 0" />
      <path d="M4 13.5H1.8M22.2 13.5H20M5 16.4l-2 1M19 16.4l2 1" />
    </IconBase>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 5v14M5 12h14" />
    </IconBase>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m21 21-4.2-4.2" />
      <circle cx="10.8" cy="10.8" r="6" />
    </IconBase>
  );
}

export function SendIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M21 3 10 14" />
      <path d="m21 3-7 18-4-7-7-4 18-7Z" />
    </IconBase>
  );
}

export function MicIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" />
    </IconBase>
  );
}

export function SpeakerIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 9v6h4l5 4V5L8 9H4Z" />
      <path d="M16 9.5a4 4 0 0 1 0 5M18.7 7a8 8 0 0 1 0 10" />
    </IconBase>
  );
}

export function PauseIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M8 5v14M16 5v14" />
    </IconBase>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </IconBase>
  );
}

export function ThumbsUpIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M7 10v11H3V10h4ZM7 10l5-7 1.4 1.1c.6.5.9 1.2.7 2L13.5 9H20c1.1 0 2 .9 2 2.1l-1.2 6.7A3 3 0 0 1 17.9 20H7" />
    </IconBase>
  );
}

export function ThumbsDownIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M7 14V3H3v11h4ZM7 14l5 7 1.4-1.1c.6-.5.9-1.2.7-2l-.6-2.9H20c1.1 0 2-.9 2-2.1l-1.2-6.7A3 3 0 0 0 17.9 4H7" />
    </IconBase>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </IconBase>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </IconBase>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" />
    </IconBase>
  );
}
