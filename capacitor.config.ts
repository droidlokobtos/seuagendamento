import type { CapacitorConfig } from "@capacitor/cli";

const appId = process.env.CAPACITOR_APP_ID ?? "com.seuagendamento.app";
const appName = process.env.CAPACITOR_APP_NAME ?? "SeuAgendamento";
const serverUrl = process.env.CAPACITOR_SERVER_URL ?? "https://seuagendamento.lovable.app";

const config: CapacitorConfig = {
  appId,
  appName,
  webDir: "capacitor-web",
  server: {
    url: serverUrl,
    cleartext: false,
    androidScheme: "https",
    allowNavigation: ["seuagendamento.lovable.app"],
  },
  android: { allowMixedContent: false, captureInput: true },
  ios: { contentInset: "automatic", scrollEnabled: true },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#241713",
      showSpinner: false,
    },
    StatusBar: { style: "DARK", backgroundColor: "#241713" },
  },
};
export default config;
