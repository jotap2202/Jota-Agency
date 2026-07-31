import crypto from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

/**
 * Sesión de una sola contraseña — este panel es para una sola persona (el
 * CEO), así que no hace falta un sistema de usuarios/registro: solo una
 * clave en PANEL_PASSWORD y una cookie de sesión firmada.
 */

const COOKIE = "jp_session";
const ALG = "HS256";

function secret(): Uint8Array {
  const s = process.env.PANEL_SECRET;
  if (!s) throw new Error("Falta PANEL_SECRET en las variables de entorno.");
  return new TextEncoder().encode(s);
}

/** Comparación en tiempo constante para no filtrar la contraseña por timing. */
export function passwordValida(intentada: string): boolean {
  const esperada = process.env.PANEL_PASSWORD;
  if (!esperada || !intentada) return false;
  const a = Buffer.from(intentada);
  const b = Buffer.from(esperada);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function crearSesion(): Promise<void> {
  const token = await new SignJWT({ ok: true })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function haySesion(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, secret());
    return true;
  } catch {
    return false;
  }
}

export async function cerrarSesion(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}
