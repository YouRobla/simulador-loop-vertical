# Simulador del Loop Vertical

¿Desde qué altura completa el loop un balín de acero? Simulación 3D con el cálculo paso a paso: dinámica circular en la cima, conservación de la energía y pérdidas por fricción.

Mecánica Clásica · UTP Huancayo · Proyecto Final

**Ver en línea:** https://yourobla.github.io/simulador-loop-vertical/

## Secciones

- **Simulador**: visor 3D y pizarra con las fórmulas en una sola pantalla. La pizarra se actualiza con los parámetros del montaje (h, R, μ, modelo).
- **Ensayos**: barrido de alturas alrededor del valor teórico. Al hacer clic en una fila, ese ensayo se abre en el simulador.
- **Maqueta**: plano a escala, cortes de manguera y pasos de armado, calculados con el montaje actual.
- **Fuentes**: antecedentes y supuestos del modelo.

## Atajos para exponer

| Tecla | Acción |
| --- | --- |
| `Espacio` | Soltar o pausar el balín |
| `R` | Reiniciar |
| `←` `→` (o `RePág` / `AvPág` del puntero) | Paso anterior o siguiente de la pizarra |
| `F` | Pantalla completa |

Con **A− / A+** se cambia el tamaño de la pizarra. **Modo claro** se ve mejor en el proyector.

## Estructura

```
index.html        página y pestañas
css/estilos.css   estilos (una pantalla en escritorio, scroll en celular)
js/fisica.js      modelo físico: pista, integración RK4, alturas mínimas
js/app.js         visor 3D (three.js), pizarra, tabla y plano
```

## Correr en local

No necesita instalar nada. Desde esta carpeta:

```
python3 -m http.server 8000
```

y abrir http://localhost:8000
