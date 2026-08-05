import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual, createHmac } from "node:crypto";

/**
 * Cifrado de credenciales de terceros.
 *
 * Las claves de Gmail, Calendar o el CRM de cada cliente no pueden estar en
 * texto plano en la base: si alguien accede a un backup, se lleva las cuentas
 * de todos los clientes de Jota Agency de una. Se cifran con AES-256-GCM
 * (autenticado: si alguien edita el ciphertext, el descifrado falla en vez de
 * devolver basura).
 *
 * La clave maestra es APP_ENCRYPTION_KEY, en variable de entorno. Nunca en el
 * repo, nunca en el frontend.
 */

const ALGO = "aes-256-gcm";

/**
 * Deriva 32 bytes de la variable de entorno. Se acepta cualquier largo de
 * secreto (se hashea) para que no haga falta generar exactamente 32 bytes a
 * mano, pero se exige un mínimo razonable.
 */
function clave(): Buffer {
  const bruta = process.env.APP_ENCRYPTION_KEY?.trim();
  if (!bruta || bruta.length < 32) {
    throw new Error(
      "APP_ENCRYPTION_KEY sin definir o demasiado corta (mínimo 32 caracteres). " +
        "Generá una con: openssl rand -base64 48",
    );
  }
  return createHash("sha256").update(bruta).digest();
}

/** ¿Se puede cifrar? Sirve para que el panel avise en vez de explotar. */
export function hayClaveMaestra(): boolean {
  const b = process.env.APP_ENCRYPTION_KEY?.trim();
  return Boolean(b && b.length >= 32);
}

/** Devuelve "iv.tag.ciphertext" en base64url. */
export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv(ALGO, clave(), iv);
  const datos = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  const tag = c.getAuthTag();
  return [iv, tag, datos].map((b) => b.toString("base64url")).join(".");
}

/** Devuelve null si el paquete está roto o la clave cambió. Nunca tira. */
export function descifrar(paquete: string): string | null {
  try {
    const [ivB, tagB, datosB] = paquete.split(".");
    if (!ivB || !tagB || !datosB) return null;
    const d = createDecipheriv(ALGO, clave(), Buffer.from(ivB, "base64url"));
    d.setAuthTag(Buffer.from(tagB, "base64url"));
    return Buffer.concat([d.update(Buffer.from(datosB, "base64url")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Firma HMAC-SHA256 en hex. Se usa para webhooks entrantes y salientes. */
export function firmar(cuerpo: string, secreto: string): string {
  return createHmac("sha256", secreto).update(cuerpo, "utf8").digest("hex");
}

/**
 * Compara firmas en tiempo constante. Comparar con `===` filtra información
 * por el tiempo de respuesta y permite adivinar la firma byte a byte.
 */
export function firmaValida(cuerpo: string, secreto: string, recibida: string): boolean {
  const esperada = firmar(cuerpo, secreto);
  const a = Buffer.from(esperada, "utf8");
  const b = Buffer.from((recibida || "").replace(/^sha256=/, "").trim(), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Token opaco para claves públicas y secretos de webhook. */
export function tokenNuevo(prefijo: string): string {
  return `${prefijo}_${randomBytes(24).toString("base64url")}`;
}
