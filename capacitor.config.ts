import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.example.dashboard", // ändere das zu deiner eigenen Kennung, z. B. at.deinname.dashboard
  appName: "Dashboard",
  webDir: "dist",
  backgroundColor: "#070a14",
  server: { androidScheme: "https" },
};

export default config;
