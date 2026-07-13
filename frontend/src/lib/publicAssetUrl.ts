// Vite dev-server quirk: public/ files are served at root (/), NOT under the
// base path. import.meta.env.BASE_URL is only reliable in production builds.
// Use this helper everywhere you reference a public/ asset by URL.
export function publicAssetUrl(path: string): string {
  return import.meta.env.DEV
    ? `/${path}`
    : `${import.meta.env.BASE_URL}${path}`;
}
