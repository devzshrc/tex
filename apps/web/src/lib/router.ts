import type { AnchorHTMLAttributes, MouseEvent } from "react";
import { createElement, useSyncExternalStore } from "react";

export interface Location {
  pathname: string;
  search: string;
}

const listeners = new Set<() => void>();

function read(): Location {
  return { pathname: window.location.pathname, search: window.location.search };
}

let current: Location = read();

function notify(): void {
  current = read();
  for (const listener of listeners) listener();
}

let popAttached = false;

function subscribe(listener: () => void): () => void {
  // pushState doesn't emit; navigate() notifies manually. Back/forward
  // emits popstate — refresh the snapshot exactly once per event.
  if (!popAttached) {
    popAttached = true;
    window.addEventListener("popstate", () => notify());
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Location {
  return current;
}

/**
 * Minimal location router for the SPA (the static host serves index.html
 * for every route). Routes: `/`, `/o`, `/o/:orgId`, `/b/:boardId`,
 * `/invite/:token` (`?card=` opens the card modal on a board page).
 */
export function useLocation(): Location {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export function navigate(path: string): void {
  const next = new URL(path, window.location.origin);
  const target = `${next.pathname}${next.search}`;
  if (`${window.location.pathname}${window.location.search}` === target) return;
  window.history.pushState(null, "", target);
  notify();
}

/** Native-link semantics with SPA navigation for unmodified primary clicks. */
export function Link({ to, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  return createElement("a", {
    ...props,
    href: to,
    onClick: (event: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event);
      if (event.defaultPrevented || props.target || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      navigate(to);
    },
  });
}

export function useSearchParam(name: string): string | null {
  return new URLSearchParams(useLocation().search).get(name);
}
