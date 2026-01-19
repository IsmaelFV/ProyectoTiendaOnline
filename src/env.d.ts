/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
  readonly SUPABASE_SERVICE_ROLE_KEY: string;
  readonly NODE_ENV: 'development' | 'production' | 'test';
  readonly BREVO_API_KEY: string;
  readonly EMAIL_FROM: string;
  readonly STRIPE_SECRET_KEY: string;
  readonly PUBLIC_STRIPE_PUBLISHABLE_KEY: string;
  readonly STRIPE_WEBHOOK_SECRET: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Extender el tipo de locals de Astro
declare namespace App {
  interface Locals {
    user?: import('@supabase/supabase-js').User;
    admin?: import('./lib/auth').AdminUser;
    isAdmin: boolean;
  }
}
