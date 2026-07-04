import { A, useNavigate } from "@solidjs/router";
import { createEffect, createSignal, type JSX, onCleanup, Show } from "solid-js";
import Avatar from "~/components/Avatar";
import LogoIcon from "~/components/LogoIcon";
import { useAuth } from "~/hooks/useAuth";
import { MuteToggle } from "~/ui";
import { useT } from "~/i18n/useT";

interface Props {
  children?: JSX.Element;
}

export default function BombermanLayout(props: Props) {
  const auth = useAuth();
  const navigate = useNavigate();
  const { locale, setLocale } = useT();
  const [open, setOpen] = createSignal(false);

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
    </div>
  );
}
