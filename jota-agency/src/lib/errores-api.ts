import type { Idioma } from "./contenido";

/**
 * Mensajes de error de las API que el usuario ve tal cual en pantalla (los
 * componentes muestran `data.error`). Estaban en castellano fijo: un
 * visitante que navegaba en inglés recibía el error en el idioma equivocado.
 */
type Clave =
  | "rateLimit"
  | "rateLimitDiag"
  | "cuerpo"
  | "campos"
  | "password"
  | "emailUsado"
  | "sesion"
  | "consultaVacia"
  | "empresaVacia";

export const ERRORES: Record<Idioma, Record<Clave, string>> = {
  en: {
    rateLimit: "Too many attempts. Please try again in a few minutes.",
    rateLimitDiag: "Too many requests in a row. Please try again in a few minutes.",
    cuerpo: "Invalid request.",
    campos: "Fill in your name, email and company.",
    password: "Password must be at least 6 characters.",
    emailUsado: "An account with that email already exists. Try signing in.",
    sesion: "You need to sign in.",
    consultaVacia: "Tell us about your business.",
    empresaVacia: "Please enter your company's name.",
  },
  es: {
    rateLimit: "Demasiados intentos. Probá de nuevo en unos minutos.",
    rateLimitDiag: "Demasiadas consultas seguidas. Probá de nuevo en unos minutos.",
    cuerpo: "Cuerpo inválido.",
    campos: "Completá nombre, email y empresa.",
    password: "La contraseña debe tener al menos 6 caracteres.",
    emailUsado: "Ya existe una cuenta con ese email. Probá entrar.",
    sesion: "Necesitás iniciar sesión.",
    consultaVacia: "Contanos sobre tu negocio.",
    empresaVacia: "Escribí el nombre de tu empresa.",
  },
};
