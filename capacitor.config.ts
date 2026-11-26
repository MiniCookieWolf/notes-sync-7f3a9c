import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.studypro.notesync',
  appName: 'Study Pro',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
