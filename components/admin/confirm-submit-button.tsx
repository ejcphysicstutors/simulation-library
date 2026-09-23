"use client";

import type { MouseEvent } from "react";

type Props = {
  children: React.ReactNode;
  message: string;
  className?: string;
};

export function ConfirmSubmitButton({ children, message, className }: Props) {
  function confirmAction(event: MouseEvent<HTMLButtonElement>) {
    if (!window.confirm(message)) event.preventDefault();
  }

  return (
    <button type="submit" className={className} onClick={confirmAction}>
      {children}
    </button>
  );
}
