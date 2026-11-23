export const CUSTOMER_INSTALL_PATH = "/zakaznik-instalace";
export const CUSTOMER_MANIFEST = "/customer-manifest.webmanifest";

export function isCustomerPath(pathname: string): boolean {
  return pathname === "/objednat" || pathname === "/sledovat" ||
    pathname === "/qr" || pathname === CUSTOMER_INSTALL_PATH ||
    pathname.startsWith("/jizda/");
}

export function appManifestForPath(pathname: string): string {
  return isCustomerPath(pathname) ? CUSTOMER_MANIFEST : "/manifest.json";
}