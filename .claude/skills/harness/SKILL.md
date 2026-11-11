---
name: harness
description: Orquesta el harness de 3 agentes (analista → desarrollador → revisor) con progreso persistente en .harness/. Úsalo con "/harness <objetivo>" para planificar y ejecutar, "/harness continuar" para retomar, o "/harness estado" para ver el progreso.
argument-hint: "<objetivo> | continuar | estado"
---

# Harness: analista → desarrollador → revisor

Eres el **orquestador**. No implementas ni revisas tú mismo: delegas en los subagentes `analista`, `desarrollador` y `revisor` (herramienta Agent con `subagent_type`) y coordinas el ciclo. El estado vive en disco para que el trabajo se pueda retomar en cualquier sesión:

- `.harness/plan.md` — listado de tareas, estados y casillas de progreso (fuente de verdad).
- `.harness/bitacora.md` — registro cronológico de lo que hace cada agente (solo se añade, nunca se borra).

Argumentos recibidos: `$ARGUMENTS`

## Estados de una tarea
`pendiente` → `en_progreso` → `en_revision` → `aprobada` ✅
                                            ↘ `rechazada` → (vuelve al desarrollador)

Solo el **revisor** puede poner `aprobada` y marcar `[x]`. Si detectas que otro agente lo hizo, revierte ese cambio y avisa al usuario.

## Modo según el argumento

### `estado`
Lee `.harness/plan.md` y muestra: total de tareas, cuántas en cada estado, % aprobado y la siguiente tarea a ejecutar. No lances agentes.

### `continuar` (o vacío)
Retoma el bucle de ejecución desde el estado actual del plan. Si no hay tareas, pide un objetivo al usuario.

### Cualquier otro texto → objetivo nuevo
1. Lanza el agente `analista` con el objetivo y el contexto que aporte el usuario. Pídele que añada las tareas a `.harness/plan.md` y registre la bitácora.
2. Muestra al usuario el listado de tareas resultante y las dudas que haya planteado el analista. **Espera su confirmación** antes de empezar a desarrollar (puede querer ajustar el plan).
3. Con la confirmación, entra en el bucle de ejecución.

## Bucle de ejecución
Repite hasta que no queden tareas ejecutables:

1. Relee `.harness/plan.md` (siempre desde disco, no de memoria).
2. Elige la siguiente tarea: primero las `rechazada`, luego `en_revision` pendientes de revisar, luego `en_progreso` interrumpidas, luego la primera `pendiente` cuyas dependencias estén todas `aprobada`.
3. Si la tarea no está en `en_revision`: lanza `desarrollador` con el ID de la tarea (`Implementa la tarea T-00X de .harness/plan.md`). Si es una corrección, recuérdale que lea la sección Revisión.
4. Lanza `revisor` con el ID (`Revisa la tarea T-00X de .harness/plan.md`).
5. Informa al usuario en una línea: `T-00X · <título> → ✅ aprobada` o `❌ rechazada (motivo breve)`.
6. Si una misma tarea se rechaza **3 veces seguidas**, detén el bucle y pide intervención del usuario con el resumen de los problemas.
7. Si el desarrollador reporta un bloqueo (dependencia, duda funcional, falta de credenciales), detente y pregunta al usuario.

Los agentes se ejecutan **de uno en uno** (nunca en paralelo): todos escriben en los mismos archivos de `.harness/`.

## Al terminar
Muestra el resumen final del plan (casillas del resumen), % completado y tareas pendientes o bloqueadas. No hagas commits salvo que el usuario lo pida.
