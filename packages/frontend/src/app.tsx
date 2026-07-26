// src/app.tsx

import { Link, Meta, MetaProvider } from "@solidjs/meta";
import { Route, Router } from "@solidjs/router";
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { SolidQueryDevtools } from "@tanstack/solid-query-devtools";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import "./index.css";
import { createEffect, createSignal, Suspense } from "solid-js";
import { WebSocketProvider } from "./hooks/useWebsocket";
import { I18nProvider } from "./i18n/I18nProvider";
import { useGlobalSettings } from "./hooks/useGlobalSettings";
import { syncMutedFromServer } from "./ui/sound";
import CookieConsent from "./components/CookieConsent";
import PlatformShell from "./components/platform/PlatformShell";
import GeneraleLayout from "./routes/games/generale/components/game/GeneraleLayout";
import Home from "./routes";
import LoginPage from "./routes/login";
import ProfilePage from "./routes/profile";
import PublicProfilePage from "./routes/profile-view";
import ForgotPasswordPage from "./routes/forgot-password";
import ResetPasswordPage from "./routes/reset-password";
import VerifyEmailPage from "./routes/verify-email";
import ConfirmEmailChangePage from "./routes/confirm-email-change";
import TermsPage from "./routes/terms";
import AboutPage from "./routes/about";
import NotfoundPage from "./routes/[...404]";
import GeneraleHub from "./routes/games/generale/routes/index";
import { BombermanHub } from "~/routes/games/bomberman/hub";
import { BombermanRoom } from "~/routes/games/bomberman/room";
import { BombermanReplays } from "~/routes/games/bomberman/replays";
import { BombermanReplayPlayer } from "~/routes/games/bomberman/replay-player";
import BombermanMapsList from "~/routes/games/bomberman/map-workshop/BombermanMapsList";
import BombermanMapEditor from "~/routes/games/bomberman/map-workshop/BombermanMapEditor";
import BombermanMapPreview from "~/routes/games/bomberman/map-workshop/BombermanMapPreview";
import BombermanLayout from "~/routes/games/bomberman/components/BombermanLayout";
import MapEditorPage from "./routes/map-editor";
import MapPreviewPage from "./routes/map-preview";
import MapsPage from "./routes/maps";
import RoomRoute from "./routes/games/generale/routes/room";
import Test from "./routes/test";
import bridge from "./testBridge";

const queryClient = new QueryClient();

const defaultWsUrl =
  (import.meta.env?.VITE_WS_URL as string | undefined) ??
  `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/api/ws`;

// ── test mode ──
const searchParams = new URLSearchParams(location.search);
const IS_TEST_MODE = searchParams.has("__test__");

function exposeTestBridge() {
  const waitFor = (condition: () => boolean, timeoutMs: number, pollMs = 100): Promise<void> => {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const iv = setInterval(() => {
        if (condition()) {
          clearInterval(iv);
          resolve();
          return;
        }
        if (Date.now() - start > timeoutMs) {
          clearInterval(iv);
          reject(new Error("waitFor timed out"));
        }
      }, pollMs);
    });
  };

  Object.defineProperty(window, "__test__", {
    value: {
      get roomId() {
        return bridge.roomId;
      },

      getGameState() {
        return bridge.gameState ? structuredClone(bridge.gameState) : null;
      },

      getConnectionState() {
        return bridge.wsManager?.connectionStateSignal[0]() ?? null;
      },

      waitForStatus(status: string, timeout = 30000) {
        return waitFor(() => {
          const s = bridge.gameState;
          return s?.status === status;
        }, timeout);
      },

      waitForWSConnected(timeout = 15000) {
        return waitFor(() => bridge.wsManager?.isConnected === true, timeout);
      },
    },
    writable: false,
    configurable: true,
  });
}

if (IS_TEST_MODE) {
  exposeTestBridge();
}

function GlobalSettingsSync(props: { setLocale: (l: string) => void }) {
  const auth = useAuth();
  const { settings } = useGlobalSettings();

  createEffect(() => {
    if (auth.user) {
      const s = settings();
      props.setLocale(s.locale);
      syncMutedFromServer(s.soundMuted);
    } else {
      const navLang = navigator.language?.startsWith("zh") ? "zh-CN" : "en";
      props.setLocale(navLang);
    }
  });

  return null;
}

export default function App() {
  const [locale, setLocale] = createSignal("en");

  return (
    <I18nProvider locale={locale()} setLocale={setLocale}>
      <QueryClientProvider client={queryClient}>
        {/* MetaProvider must wrap anything that uses Title/useHead */}
        <MetaProvider>
          <Link rel="icon" type="image/svg+xml" href="/favicon.svg" />
          <Meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
          <AuthProvider>
            <GlobalSettingsSync setLocale={setLocale} />
            <WebSocketProvider url={defaultWsUrl} autoConnect={false}>
              <Router
                root={(props) => (
                  <>
                    <Suspense>{props.children}</Suspense>
                    <CookieConsent />
                  </>
                )}
              >
                {/* Platform routes — wrapped in PlatformShell */}
                <Route path="/" component={PlatformShell}>
                  <Route path="/" component={Home} />
                  <Route path="/test" component={Test} />
                  <Route path="/login" component={LoginPage} />
                  <Route path="/profile" component={ProfilePage} />
                  <Route path="/profile/:userId" component={PublicProfilePage} />
                  <Route path="/forgot-password" component={ForgotPasswordPage} />
                  <Route path="/reset-password" component={ResetPasswordPage} />
                  <Route path="/verify-email" component={VerifyEmailPage} />
                  <Route path="/confirm-email-change" component={ConfirmEmailChangePage} />
                  <Route path="/terms" component={TermsPage} />
                  <Route path="/about" component={AboutPage} />
                </Route>

                {/* Generale Hub — wrapped in GeneraleLayout */}
                <Route path="/generale" component={GeneraleLayout}>
                  <Route path="/" component={GeneraleHub} />
                </Route>

                {/* Bomberman routes */}
                <Route path="/bomberman" component={BombermanLayout}>
                  <Route path="/" component={BombermanHub} />
                  <Route path="/room/:id" component={BombermanRoom} />
                  <Route path="/maps" component={BombermanMapsList} />
                  <Route path="/maps/editor" component={BombermanMapEditor} />
                  <Route path="/maps/editor/:id" component={BombermanMapEditor} />
                  <Route path="/maps/preview/:id" component={BombermanMapPreview} />
                  <Route path="/replays" component={BombermanReplays} />
                  <Route path="/replay/:id" component={BombermanReplayPlayer} />
                </Route>

                {/* Generale game routes */}
                <Route path="/generale/room/:id" component={RoomRoute} />
                <Route path="/maps" component={MapsPage} />
                <Route path="/maps/editor" component={MapEditorPage} />
                <Route path="/maps/editor/:id" component={MapEditorPage} />
                <Route path="/maps/preview/:id" component={MapPreviewPage} />

                {/* Catch-all 404 */}
                <Route path="*" component={NotfoundPage} />
              </Router>
            </WebSocketProvider>
          </AuthProvider>
        </MetaProvider>

        <SolidQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </I18nProvider>
  );
}
