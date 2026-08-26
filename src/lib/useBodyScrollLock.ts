"use client";

import { useEffect } from "react";

let lockCount = 0;
let previousOverflow = "";
let previousHtmlOverflow = "";
let previousPadding = "";

function lockBody() {
  lockCount += 1;
  if (lockCount !== 1) return;
  const { body, documentElement } = document;
  previousOverflow = body.style.overflow;
  previousHtmlOverflow = documentElement.style.overflow;
  previousPadding = body.style.paddingInlineEnd;
  const scrollbar = window.innerWidth - documentElement.clientWidth;
  body.style.overflow = "hidden";
  documentElement.style.overflow = "hidden";
  if (scrollbar > 0) body.style.paddingInlineEnd = `${scrollbar}px`;
  document.documentElement.classList.add("modal-open");
  document.body.classList.add("modal-open");
}

function unlockBody() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount > 0) return;
  document.body.style.overflow = previousOverflow;
  document.documentElement.style.overflow = previousHtmlOverflow;
  document.body.style.paddingInlineEnd = previousPadding;
  document.documentElement.classList.remove("modal-open");
  document.body.classList.remove("modal-open");
}

function isInsideAllowedScroll(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(".modal, .toast-stack, .nav-drawer"));
}

export function useBodyScrollLock(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    lockBody();
    function block(event: Event) {
      if (isInsideAllowedScroll(event.target)) return;
      event.preventDefault();
    }
    document.addEventListener("wheel", block, { passive: false });
    document.addEventListener("touchmove", block, { passive: false });
    return () => {
      document.removeEventListener("wheel", block);
      document.removeEventListener("touchmove", block);
      unlockBody();
    };
  }, [enabled]);
}
