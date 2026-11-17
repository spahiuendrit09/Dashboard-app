import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

// Home (Haus, gefüllt)
export const HouseIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M11.3 2.4a1.1 1.1 0 0 1 1.4 0l8.2 6.8c.4.3.6.8.6 1.3V19a2.5 2.5 0 0 1-2.5 2.5h-3.3a1 1 0 0 1-1-1v-4.7a1 1 0 0 0-1-1h-2.6a1 1 0 0 0-1 1v4.7a1 1 0 0 1-1 1H4.9A2.5 2.5 0 0 1 2.4 19v-8.5c0-.5.2-1 .6-1.3l8.3-6.8Z" />
  </Icon>
);

// Browse (Kompass / Entdecken)
export const CompassIcon = (props: IconProps) => (
  <Icon {...props}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19Zm3.9 5.6c.4-.9-.4-1.7-1.3-1.3l-5.3 2.4a1.5 1.5 0 0 0-.8.8l-2.4 5.3c-.4.9.4 1.7 1.3 1.3l5.3-2.4c.4-.2.7-.4.8-.8l2.4-5.3ZM12 10.7a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6Z"
    />
  </Icon>
);

// Radio (Funkwellen)
export const RadioIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="2.6" />
    <path
      d="M7.4 7.4a1 1 0 0 1 0 1.4 4.6 4.6 0 0 0 0 6.4 1 1 0 1 1-1.4 1.4 6.6 6.6 0 0 1 0-9.2 1 1 0 0 1 1.4 0Zm9.2 0a1 1 0 0 1 1.4 0 6.6 6.6 0 0 1 0 9.2 1 1 0 1 1-1.4-1.4 4.6 4.6 0 0 0 0-6.4 1 1 0 0 1 0-1.4Z"
    />
    <path
      d="M4.6 4.6a1 1 0 0 1 0 1.4 8.6 8.6 0 0 0 0 12 1 1 0 1 1-1.4 1.4 10.6 10.6 0 0 1 0-14.8 1 1 0 0 1 1.4 0Zm14.8 0a1 1 0 0 1 1.4 0 10.6 10.6 0 0 1 0 14.8 1 1 0 1 1-1.4-1.4 8.6 8.6 0 0 0 0-12 1 1 0 0 1 0-1.4Z"
    />
  </Icon>
);

// Library (Bücher / Bibliothek)
export const BooksIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H9a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5A2.5 2.5 0 0 1 4 19.5v-15Z" />
    <path d="M12 3a1 1 0 0 1 1-1h2.5a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H13a1 1 0 0 1-1-1V3Z" />
    <path d="M18.4 4.1a1 1 0 0 1 1.3-.6l.9.3a1 1 0 0 1 .6 1.3l-5 14.4a1 1 0 0 1-1.3.6l-.9-.3a1 1 0 0 1-.6-1.3l5-14.4Z" />
  </Icon>
);

// Weitere nützliche iOS-Style Icons
export const SearchIcon = (props: IconProps) => (
  <Icon {...props}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M10.5 3a7.5 7.5 0 1 0 4.6 13.4l3.7 3.7a1 1 0 0 0 1.4-1.4l-3.7-3.7A7.5 7.5 0 0 0 10.5 3ZM5 10.5a5.5 5.5 0 1 1 11 0 5.5 5.5 0 0 1-11 0Z"
    />
  </Icon>
);

export const SettingsIcon = (props: IconProps) => (
  <Icon {...props}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M10.6 2.5a1.5 1.5 0 0 1 2.8 0l.3.9c.1.4.5.7.9.8.4.1.8 0 1.1-.2l.8-.5a1.5 1.5 0 0 1 2 2l-.5.8c-.2.3-.3.7-.2 1.1.1.4.4.8.8.9l.9.3a1.5 1.5 0 0 1 0 2.8l-.9.3c-.4.1-.7.5-.8.9-.1.4 0 .8.2 1.1l.5.8a1.5 1.5 0 0 1-2 2l-.8-.5c-.3-.2-.7-.3-1.1-.2-.4.1-.8.4-.9.8l-.3.9a1.5 1.5 0 0 1-2.8 0l-.3-.9c-.1-.4-.5-.7-.9-.8-.4-.1-.8 0-1.1.2l-.8.5a1.5 1.5 0 0 1-2-2l.5-.8c.2-.3.3-.7.2-1.1-.1-.4-.4-.8-.8-.9l-.9-.3a1.5 1.5 0 0 1 0-2.8l.9-.3c.4-.1.7-.5.8-.9.1-.4 0-.8-.2-1.1l-.5-.8a1.5 1.5 0 0 1 2-2l.8.5c.3.2.7.3 1.1.2.4-.1.8-.4.9-.8l.3-.9ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"
    />
  </Icon>
);

export const UserIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="7.5" r="4.5" />
    <path d="M3.5 19.5c0-3.3 3.8-5.5 8.5-5.5s8.5 2.2 8.5 5.5c0 1.1-.9 2-2 2h-13c-1.1 0-2-.9-2-2Z" />
  </Icon>
);

export const HeartIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 21.2c-.3 0-.6-.1-.9-.3C6.200 17.300 2.500 14 2.500 9.700A5.200 5.200 0 0 1 7.700 4.500c1.700 0 3.400.9 4.300 2.300.9-1.400 2.600-2.300 4.300-2.300a5.200 5.200 0 0 1 5.200 5.200c0 4.300-3.700 7.600-8.600 11.200-.3.200-.6.300-.9.300Z" />
  </Icon>
);