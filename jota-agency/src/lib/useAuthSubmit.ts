"use client";

import { useRef, useState } from "react";
import { signIn } from "next-auth/react";

/** Validación de email real (antes: `includes("@") && includes(".")`, aceptaba "a@."). */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type MensajesAuth = {
  email: string;
  password: string;
  campos: string;
  login: string;
  cuentaCreadaSinLogin: string;
  conexion: string;
};

/**
 * Estado y envío compartidos entre el portón de la landing (AuthGate) y la
 * página /acceder (AuthForm) — antes cada uno tenía su propia copia de esta
 * lógica, y ya habían divergido (AuthForm no traducía sus mensajes).
 */
export function useAuthSubmit(mensajes: MensajesAuth) {
  const [tab, setTab] = useState<"signup" | "login">("signup");
  const [nombre, setNombre] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  // Guard sincrónico: `cargando` (estado de React) puede no haberse
  // repintado todavía cuando llega un segundo click rápido, así que no
  // alcanza como única defensa contra el doble-submit.
  const enVueloRef = useRef(false);

  const isSignup = tab === "signup";

  const submit = async (destino: string) => {
    if (enVueloRef.current) return;
    setError(null);
    const e = email.trim().toLowerCase();
    if (!EMAIL_RE.test(e)) return setError(mensajes.email);
    if (password.length < 6) return setError(mensajes.password);
    if (isSignup && (!nombre.trim() || !empresa.trim())) return setError(mensajes.campos);

    enVueloRef.current = true;
    setCargando(true);
    try {
      if (isSignup) {
        const res = await fetch("/api/registro", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: nombre.trim(), empresa: empresa.trim(), email: e, password }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || mensajes.login);
          return;
        }
      }
      const result = await signIn("credentials", { email: e, password, redirect: false });
      if (result?.error) {
        setError(isSignup ? mensajes.cuentaCreadaSinLogin : mensajes.login);
        return;
      }
      window.location.href = destino;
    } catch {
      setError(mensajes.conexion);
    } finally {
      enVueloRef.current = false;
      setCargando(false);
    }
  };

  return {
    tab, setTab, isSignup,
    nombre, setNombre,
    empresa, setEmpresa,
    email, setEmail,
    password, setPassword,
    error, setError,
    cargando,
    submit,
  };
}
