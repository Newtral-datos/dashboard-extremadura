import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // 👈 imprescindible para poder entrar desde el túnel
    port: 5173,      // 👈 asegúrate de que Tunnelmole apunte a este puerto
    allowedHosts: [
      'strfgi-ip-80-28-53-229.tunnelmole.net', // tu dominio de Tunnelmole
      '.tunnelmole.net',                       // y cualquier otro subdominio de tunnelmole
    ],
  },
});
