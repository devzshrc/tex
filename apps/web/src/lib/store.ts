import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ConnectionStatus = "connecting" | "live" | "reconnecting" | "offline";

interface UiState {
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  shortcutsOpen: boolean;
  setShortcutsOpen: (open: boolean) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

export interface FavoriteBoard {
  id: string;
  title: string;
  orgId: string;
}

interface FavoritesState {
  favorites: FavoriteBoard[];
  toggleFavorite: (board: FavoriteBoard) => void;
  isFavorite: (id: string) => boolean;
}

interface ConnectionState {
  statusByBoard: Record<string, ConnectionStatus>;
  setStatus: (boardId: string, status: ConnectionStatus) => void;
}

/** Ephemeral UI state (dialogs). Sidebar persists across reloads. */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      paletteOpen: false,
      setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
      shortcutsOpen: false,
      setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    { name: "tex-ui", partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed }) as UiState },
  ),
);

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      favorites: [],
      toggleFavorite: (board) =>
        set((s) => ({
          favorites: s.favorites.some((f) => f.id === board.id)
            ? s.favorites.filter((f) => f.id !== board.id)
            : [...s.favorites, board].slice(-20),
        })),
      isFavorite: (id) => get().favorites.some((f) => f.id === id),
    }),
    { name: "tex-favorites" },
  ),
);

export const useConnectionStore = create<ConnectionState>()((set) => ({
  statusByBoard: {},
  setStatus: (boardId, status) => set((s) => ({ statusByBoard: { ...s.statusByBoard, [boardId]: status } })),
}));

export interface RecentBoard {
  id: string;
  title: string;
  orgId: string;
}

const RECENT_KEY = "tex-recent-boards";

export function getRecentBoards(): RecentBoard[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentBoard[];
    return Array.isArray(parsed) ? parsed.slice(0, 8) : [];
  } catch {
    return [];
  }
}

export function pushRecentBoard(board: RecentBoard): void {
  try {
    const rest = getRecentBoards().filter((b) => b.id !== board.id);
    localStorage.setItem(RECENT_KEY, JSON.stringify([board, ...rest].slice(0, 8)));
  } catch {
    // Private mode etc. — recents are best-effort.
  }
}
