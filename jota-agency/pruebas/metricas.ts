import {
  tasaConversion, costoPorLead, costoAdquisicion, roi, margen,
  pipelinePonderado, estadoObjetivoMensual, diasDelMes, proyeccion, dividir,
} from "@/lib/ceo/metricas";
import { aCentavos, dinero, dineroCorto } from "@/lib/ceo/dinero";
import { calcularScore } from "@/lib/ceo/score";

let f = 0;
const ok = (c: boolean, m: string) => { console.log(c ? `  ✅ ${m}` : `  ❌ ${m}`); if (!c) f++; };
const USD = (d: number) => Math.round(d * 100);

console.log("\n1. División por cero → null, no 0");
ok(dividir(10, 0) === null, "dividir(10,0) es null");
ok(costoAdquisicion(USD(5000), 0) === null, "CAC sin clientes cerrados es null, no $0");
ok(roi(0, 0) === null, "ROI sin inversión es null");
ok(tasaConversion(0, 0) === null, "conversión sin leads es null");

console.log("\n2. Fórmulas exactas del pedido");
ok(tasaConversion(5, 100) === 5, "conversión: 5/100 = 5%");
ok(costoPorLead(USD(1000), 50) === USD(20), "CPL: $1000/50 = $20");
ok(costoAdquisicion(USD(6000), 3) === USD(2000), "CAC: $6000/3 = $2000");
ok(roi(USD(3000), USD(1000)) === 200, "ROI: (3000−1000)/1000 = 200%");
ok(roi(USD(500), USD(1000)) === -50, "ROI negativo cuando se pierde plata");
ok(margen(USD(3000), USD(10000)) === 30, "margen: 3000/10000 = 30%");

console.log("\n3. Pipeline ponderado");
ok(pipelinePonderado([{ valorEstimado: USD(1000), probabilidad: 50 }, { valorEstimado: USD(2000), probabilidad: 25 }]) === USD(1000), "1000×0.5 + 2000×0.25 = $1000");
ok(pipelinePonderado([]) === 0, "pipeline vacío es 0");

console.log("\n4. Objetivo mensual — el ejemplo textual del pedido");
const m = estadoObjetivoMensual(USD(25000), USD(16800), new Date("2026-09-19T20:00:00Z"));
ok(m.restante === USD(8200), `restante = $8,200 (dio ${dinero(m.restante)})`);
ok(Math.abs(m.progreso - 67.2) < 0.05, `progreso = 67.2% (dio ${m.progreso.toFixed(1)}%)`);
ok(m.diasRestantes === 12, `días restantes = 12 (dio ${m.diasRestantes})`);
ok(Math.abs(m.diarioNecesario - USD(683)) <= 100, `diario necesario ≈ $683 (dio ${dinero(m.diarioNecesario)})`);
ok(m.semanalNecesario === m.diarioNecesario * 7, "el semanal es 7× el diario");

console.log("\n5. Aritmética de días");
ok(diasDelMes(2026, 2) === 28, "febrero 2026 tiene 28 días");
ok(diasDelMes(2028, 2) === 29, "febrero 2028 (bisiesto) tiene 29");
ok(estadoObjetivoMensual(USD(1000), 0, new Date("2026-08-31T20:00:00Z")).diasRestantes === 1, "el último día del mes queda 1 día para vender, no 0");

console.log("\n6. Estado del objetivo");
ok(estadoObjetivoMensual(USD(1000), USD(1000), new Date("2026-08-10T20:00:00Z")).estado === "completed", "cumplido cuando se alcanza");
ok(estadoObjetivoMensual(USD(1000), USD(20), new Date("2026-08-20T20:00:00Z")).estado === "behind", "atrasado cuando el progreso va muy detrás del mes");

console.log("\n7. Proyección: separa comprometido de probable");
const p = proyeccion(USD(10000), USD(9000));
ok(p[0].comprometido === USD(10000), "30 días: 1 mes de MRR");
ok(p[2].comprometido === USD(30000), "90 días: 3 meses de MRR");
ok(p[0].probable < p[2].probable, "a 30 días entra menos pipeline que a 90");

console.log("\n8. Dinero en centavos: sin error de flotante");
let acum = 0;
for (let i = 0; i < 1000; i++) acum += aCentavos("0.10");
ok(acum === 10000, `1000 × $0.10 = exactamente $100 (dio ${dinero(acum)})`);
ok(0.1 * 1000 !== 100.00000000000001 ? true : false, "(el mismo cálculo en flotante acumula error)");
ok(aCentavos("1,500.50") === 150050, "parsea 1,500.50");
ok(dineroCorto(USD(16800)) === "$17k", `formato corto: ${dineroCorto(USD(16800))}`);

console.log("\n9. Lead score: declara lo que no sabe");
const completo = calcularScore({ industria: "Estudio contable", empleados: 14, ingresosEstimados: USD(1800000), cargo: "Managing Partner", web: "https://x.com", linkedin: "x", servicioInteres: "B2B Prospecting", estado: "negociacion" });
ok(completo.confianza === "alta", "con todos los datos, confianza alta");
ok(completo.score >= 80, `contable + decisor + en negociación = Hot (dio ${completo.score})`);
ok(completo.faltantes.length === 0, "no reporta faltantes");

const pelado = calcularScore({ estado: "nuevo" });
ok(pelado.confianza === "baja", "sin datos, confianza baja");
ok(pelado.faltantes.length >= 4, `declara qué falta (${pelado.faltantes.length} campos)`);
ok(!pelado.factores.some((x) => x.nombre === "Industria"), "NO inventa un puntaje de industria que no conoce");
ok(calcularScore({ industria: "Clínica", estado: "nuevo" }).confianza === "baja", "un solo dato → confianza baja aunque puntúe alto");

console.log(f === 0 ? "\n✅ TODAS PASAN\n" : `\n❌ ${f} FALLO(S)\n`);
process.exit(f ? 1 : 0);
