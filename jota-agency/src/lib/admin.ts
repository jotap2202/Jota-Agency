/**
 * Quién puede entrar al panel de leads.
 *
 * Por defecto, solo el dueño de la agencia. Para cambiarlo o sumar gente,
 * definí ADMIN_EMAILS en Vercel separando con comas. Por ejemplo:
 *   ADMIN_EMAILS="jotanico17@gmail.com,socio@jota.agency"
 */
const POR_DEFECTO = "jotanico17@gmail.com";

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || POR_DEFECTO)
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function esAdmin(email?: string | null): boolean {
  if (!email) return false;
  return adminEmails().includes(email.trim().toLowerCase());
}
