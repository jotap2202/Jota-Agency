# Pruebas

Corren con el TypeScript nativo de Node 22 (`--experimental-strip-types`), sin
agregar ninguna dependencia al proyecto. `hook.mjs` resuelve el alias `@/` de
tsconfig para poder ejecutar el código real de `src/` sin modificarlo.

```bash
npm test        # fórmulas, dinero y lead scoring — no necesita base de datos
npm run test:db # además: overview y briefing contra un Postgres real
```

`test:db` necesita un `DATABASE_URL` apuntando a una base **descartable**:
trunca las tablas al terminar. No apuntarlo nunca a producción.
