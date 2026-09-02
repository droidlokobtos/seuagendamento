import { Preferences } from "@capacitor/preferences";
import { isNativeApp } from "@/lib/mobile";
import { brokeredPreviewStorage } from "./previewAuthStorage";

export function mobileAwareAuthStorage() {
  if (!isNativeApp()) return brokeredPreviewStorage();
  return {
    getItem: async (key: string) => (await Preferences.get({ key })).value,
    setItem: async (key: string, value: string) => {
      await Preferences.set({ key, value });
    },
    removeItem: async (key: string) => {
      await Preferences.remove({ key });
    },
  };
}
