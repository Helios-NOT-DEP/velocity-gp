/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FRONTEND_MAGIC_LINK_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
