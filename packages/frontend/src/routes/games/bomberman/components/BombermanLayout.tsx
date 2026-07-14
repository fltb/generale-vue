import { A, useNavigate } from "@solidjs/router";
import { createEffect, createSignal, type JSX, onCleanup, Show } from "solid-js";
import Avatar from "~/components/Avatar";
import LogoIcon from "~/components/LogoIcon";
import { useAuth } from "~/hooks/useAuth";
import { MuteToggle, Modal } from "~/ui";
import { useT } from "~/i18n/useT";
import { KeybindingSettings } from "./KeybindingSettings";

interface Props {
  children?: JSX.Element;
}

export default function BombermanLayout(props: Props) {
  const auth = useAuth();
  const navigate = useNavigate();
  const { locale, setLocale } = useT();
  const [open, setOpen] = createSignal(false);
  const [showSettings, setShowSettings] = createSignal(false);

  createEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!open()) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const menu = document.getElementById("bm-nav-user-menu");
      const btn = document.getElementById("bm-nav-user-button");
      if (menu && btn && !menu.contains(target) && !btn.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("click", handler);
    onCleanup(() => document.removeEventListener("click", handler));
  });

  async function handleLogout() {
    await auth.logout();
    setOpen(false);
    navigate("/login", { replace: true });
  }

  return (
    <div class="flex flex-col min-h-screen">
      <nav class="bg-base-100 border-b-2 border-base-300 px-6 flex items-center justify-between h-14 shrink-0">
        <div class="flex items-center gap-2">
          <A
            href="/"
            class="text-base-content/40 hover:text-base-content flex items-center gap-1 px-1"
            aria-label="Back to Platform"
          >
            <svg
              class="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </A>
          <span class="text-base-content/15 select-none">|</span>
          <A href="/bomberman" class="flex items-center gap-2 text-primary">
            <LogoIcon size={28} />
            <span class="font-semibold text-primary text-sm tracking-wide">Bomberman</span>
          </A>
        </div>
        <div class="flex items-center gap-3">
          <MuteToggle />
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            class="btn btn-sm btn-ghost btn-square"
            aria-label="Settings"
          >
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
          <div class="flex items-center gap-1">
            {[
              { code: "en", label: "EN" },
              { code: "zh-CN", label: "中文" },
            ].map((lang) => (
              <button
                type="button"
                onClick={() => setLocale(lang.code)}
                class={`px-2 py-1 text-xs rounded border ${
                  locale() === lang.code
                    ? "border-base-content/30 bg-base-300 text-base-content"
                    : "border-base-300 hover:bg-base-300 text-base-content/40 hover:text-base-content"
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
          <Show
            when={auth.user}
            fallback={
              <A href="/login" class="px-3 py-1 rounded bg-base-300 hover:bg-base-300/80 text-sm">
                Login
              </A>
            }
          >
            <div class="relative">
              <button
                type="button"
                id="bm-nav-user-button"
                onClick={() => setOpen(!open())}
                class="flex items-center gap-2 rounded hover:bg-base-300 px-2 py-1"
              >
                <Avatar
                  src={auth.user?.avatarThumbUrl ?? auth.user?.avatarUrl ?? ""}
                  alt={auth.user?.displayName || auth.user?.username || auth.user?.email}
                  size={28}
                />
                <span class="text-sm max-w-[100px] truncate hidden sm:inline">
                  {auth.user?.displayName || auth.user?.username || auth.user?.email || "User"}
                </span>
              </button>
              <div
                id="bm-nav-user-menu"
                class={`absolute right-0 mt-2 w-44 bg-white text-gray-800 rounded shadow-lg z-50 ${
                  open() ? "block" : "hidden"
                }`}
              >
                <A href="/profile" class="block px-4 py-2 text-sm hover:bg-sky-100" onClick={() => setOpen(false)}>
                  Profile
                </A>
                <button
                  type="button"
                  onClick={handleLogout}
                  class="w-full text-left px-4 py-2 text-sm hover:bg-sky-100"
                >
                  Logout
                </button>
              </div>
            </div>
          </Show>
        </div>
      </nav>

      <main class="flex-1 min-w-0">{props.children}</main>

      <Show when={showSettings()}>
        <Modal boxClass="max-w-lg">
          <div class="flex justify-end mb-2">
            <button
              type="button"
              class="btn btn-sm btn-ghost btn-square"
              onClick={() => setShowSettings(false)}
              aria-label="Close settings"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <KeybindingSettings />
        </Modal>
      </Show>
    </div>
  );
}
