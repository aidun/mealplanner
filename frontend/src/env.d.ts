/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEPLOYED_AT?: string;
  readonly VITE_DEPLOY_TIMEZONE?: string;
  readonly VITE_BUILD_SHA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
