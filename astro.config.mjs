import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import node from '@astrojs/node';

export default defineConfig({
  output: 'server',
  site: 'https://mccook8g4sw8kg8kw8kkwoko.victoriafp.online',
  adapter: node({
    mode: 'standalone'
  }),
  security: {
    // Desactivar checkOrigin porque Astro corre detrás de Cloudflare + Caddy
    // (reverse proxy). El Origin del navegador nunca coincidirá con el host
    // interno (localhost:4321). Cloudflare ya protege contra CSRF a nivel WAF.
    checkOrigin: false
  },
  integrations: [
    react(),
    tailwind({
      applyBaseStyles: false,
    })
  ],
  vite: {
    optimizeDeps: {
      exclude: ['@supabase/supabase-js']
    }
  }
});
