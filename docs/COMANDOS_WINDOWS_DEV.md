# Comandos de desarrollo en Windows

Esta guía existe para evitar perder tiempo con diferencias entre PowerShell, CMD y Git Bash durante el desarrollo de **JW Modbus Tool**.

## Terminal recomendada

Para este proyecto conviene usar **PowerShell** dentro de VS Code o una terminal externa.

Cuando una instrucción esté pensada para Git Bash, debe indicarse explícitamente. Si no se indica nada, asumir PowerShell.

## Comandos base del proyecto

### Actualizar rama actual

```powershell
git pull
```

### Typecheck

En PowerShell usar siempre:

```powershell
npm.cmd run typecheck
```

También funciona:

```powershell
cmd.exe /c "npm run typecheck"
```

Evitar usar solamente:

```powershell
npm run typecheck
```

En algunas instalaciones de Windows puede abrir la ventana **¿Cómo quieres abrir este archivo?** porque intenta resolver `npm` como asociación de archivo en vez de ejecutar `npm.cmd`.

### Iniciar app en modo desarrollo

En PowerShell usar:

```powershell
.\start-dev.bat
```

No usar solamente:

```powershell
start-dev.bat
```

PowerShell no ejecuta scripts del directorio actual sin anteponer `./` o `.\`.

### Flujo normal de validación

```powershell
git pull
npm.cmd run typecheck
.\start-dev.bat
```

## Git: revisar, commitear y subir cambios

```powershell
git status
git diff -- src/renderer/simple-tests-consolidated.tsx src/renderer/simple-tests-dom-history-bridge.ts
git add src/renderer/simple-tests-consolidated.tsx src/renderer/simple-tests-dom-history-bridge.ts
git commit -m "fix(tests): emit native test run history events"
git push
```

## Crear scripts temporales en PowerShell

En PowerShell **no usar** heredoc estilo Bash:

```bash
cat > archivo.cjs <<'EOF'
...
EOF
```

Ese formato genera errores como:

```text
Falta la especificación de archivo después del operador de redirección.
El operador '<' está reservado para uso futuro.
```

En PowerShell usar este formato:

```powershell
@'
console.log("script temporal");
'@ | Set-Content -Path .\tmp-script.cjs -Encoding UTF8

node .\tmp-script.cjs
Remove-Item .\tmp-script.cjs
```

## Crear scripts temporales en Git Bash

En Git Bash sí se puede usar:

```bash
cat > tmp-script.cjs <<'EOF'
console.log("script temporal");
EOF

node tmp-script.cjs
rm tmp-script.cjs
```

## Debug en DevTools

Abrir DevTools en Electron:

```text
Ctrl + Shift + I
```

### Historial de pruebas

Contar elementos guardados:

```js
window.__jwSimpleTestsDomHistoryDebug.count()
```

Ver historial completo:

```js
window.__jwSimpleTestsDomHistoryDebug.get()
```

Última corrida capturada:

```js
window.__jwSimpleTestsDomHistoryDebug.lastRun()
```

Limpiar historial manualmente:

```js
window.__jwSimpleTestsDomHistoryDebug.clear()
```

La versión consolidada debe reportar:

```js
window.__jwSimpleTestsDomHistoryDebug.lastRun()
```

con:

```js
source: "native-run-event"
```

Eso confirma que el historial ya se genera desde el evento real de `TestsView`, no desde lectura visual del DOM.

## Validación esperada de Pruebas

Con 8 pasos activos:

1. Nueva sesión o Limpiar registro debe dejar `Historial pruebas` en `0/0`.
2. Una ejecución completa debe subir a `8/8`.
3. Tres ejecuciones completas deben subir a `24/24`.
4. Diez ejecuciones completas deben subir a `80/80`.
5. Veinte ejecuciones completas deben subir a `160/160`.

Si aparece un valor que no sea múltiplo de 8 después de ejecuciones completas, revisar el mecanismo de historial.

## Nota sobre PowerShell y Python

Evitar:

```powershell
python - <<PY
...
PY
```

Eso es sintaxis Bash y en PowerShell abre errores de redirección. Si se necesita ejecutar Python en PowerShell, usar archivo temporal o:

```powershell
@'
print("python ok")
'@ | py -3 -
```

Si `python` abre la ventana **¿Cómo quieres abrir este archivo?**, usar `py -3` o preferir scripts `.cjs` con Node para este proyecto.
