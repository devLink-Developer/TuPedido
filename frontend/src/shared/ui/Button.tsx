import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

export function Button({
  children,
  className = "",
  ...props
}: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>) {
  return (
    <button
      {...props}
      className={`rounded-full bg-brand-500 px-4 py-3 text-sm font-semibold text-white shadow-float transition disabled:cursor-not-allowed disabled:bg-zinc-300 ${className}`}
    >
      {children}
    </button>
  );
}
