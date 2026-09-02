import { useEffect } from "react";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { isNativeApp, nativePlatform } from "@/lib/mobile";

const INTERNAL_HOSTS = new Set(["seuagendamento.lovable.app"]);

export function CapacitorBridge() {
  useEffect(() => {
    if (!isNativeApp()) return;
    void SplashScreen.hide();
    void StatusBar.setStyle({ style: Style.Dark });
    if (nativePlatform() === "android") void StatusBar.setBackgroundColor({ color: "#241713" });

    const subscriptions = [
      App.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack || window.history.length > 1) window.history.back();
        else void App.exitApp();
      }),
      App.addListener("appUrlOpen", ({ url }) => {
        try {
          const target = new URL(url);
          if (INTERNAL_HOSTS.has(target.hostname))
            window.location.assign(`${target.pathname}${target.search}${target.hash}`);
        } catch {
          /* URL inválida. */
        }
      }),
    ];

    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement | null)?.closest(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (!anchor || anchor.hasAttribute("download")) return;
      const target = new URL(anchor.href, window.location.href);
      const externalProtocol = ["mailto:", "tel:", "sms:", "whatsapp:"].includes(target.protocol);
      const externalHost =
        target.protocol.startsWith("http") && !INTERNAL_HOSTS.has(target.hostname);
      // Protocolos como telefone e e-mail devem ser entregues ao sistema operacional.
      if (externalProtocol) return;
      if (!externalHost) return;
      event.preventDefault();
      void Browser.open({ url: target.href, presentationStyle: "popover" });
    };
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      void Promise.all(subscriptions.map(async (subscription) => (await subscription).remove()));
    };
  }, []);
  return null;
}
