# LISTA DE TAREAS - APLICACIÓN - HOY

**Fecha**: 6 de Diciembre 2024  
**Última actualización**: 6 Dic 2024

---

## ✅ CORRECCIONES COMPLETADAS HOY

### 1. **Cursor en tabbed-notepad-element.tsx** ✅
- **Problema**: Cursor volvía al inicio al escribir
- **Solución**: Implementado estado local para preservar cursor
- **Archivo**: `src/components/canvas/elements/tabbed-notepad-element.tsx`
- **Estado**: ✅ CORREGIDO

### 2. **Botón Pincel - Color desaparece** ✅
- **Problema**: El color no persistía al aplicar sin selección
- **Solución**: Envolver contenido en span con estilo inline
- **Archivo**: `src/components/canvas/formatting-toolbar.tsx`
- **Estado**: ✅ CORREGIDO

### 3. **Export PNG solo área visible** ✅
- **Problema**: Exportaba área incorrecta
- **Solución**: Mejorado con scrollX, scrollY y getBoundingClientRect
- **Archivo**: `src/app/board/[boardId]/page.tsx`
- **Estado**: ✅ MEJORADO

### 4. **Dictado simplificado según Readme 18 Nov** ✅
- **Problema**: Código complejo con timeouts innecesarios
- **Solución**: Simplificado hook useDictation, eliminado código viejo
- **Archivos**: 
  - `src/hooks/use-dictation.ts` - Simplificado
  - `src/app/board/[boardId]/page.tsx` - Limpiado referencias
- **Estado**: ✅ COMPLETADO

---

## 🔴 PROBLEMAS PENDIENTES - CRÍTICOS

### 1. **Dictado duplica texto**
- **Problema**: El dictado duplica el texto al escribir
- **Archivo**: `src/lib/dictation-helper.ts` o `src/hooks/use-dictation-input.ts`
- **Estado**: ⚠️ PENDIENTE
- **Prioridad**: ALTA

### 2. **Dictado no funciona en todos los campos editables**
- **Problema**: No funciona en algunos elementos (accordion, comment, etc.)
- **Archivos**: 
  - `src/components/canvas/elements/accordion-element.tsx`
  - `src/components/canvas/elements/comment-element.tsx`
- **Estado**: ⚠️ PENDIENTE
- **Prioridad**: ALTA

### 3. **No se puede dictar en accordion**
- **Causa**: `insertDictationTextToContentEditable` no se ejecuta correctamente
- **Archivo**: `src/components/canvas/elements/accordion-element.tsx` - `EditableContent`
- **Línea**: ~300-310
- **Estado**: ⚠️ PENDIENTE
- **Prioridad**: ALTA

### 4. **No se guarda automáticamente en accordion**
- **Causa**: `debounceMs` muy alto o `onSave` no se ejecuta
- **Archivo**: `src/components/canvas/elements/accordion-element.tsx` - `EditableContent`
- **Línea**: ~269-278
- **Estado**: ⚠️ PENDIENTE
- **Prioridad**: MEDIA

### 5. **comment-element.tsx - no funciona**
- **Problema**: El elemento comentario no funciona correctamente
- **Archivo**: `src/components/canvas/elements/comment-element.tsx`
- **Estado**: ⚠️ PENDIENTE
- **Prioridad**: MEDIA

---

## 🟡 PROBLEMAS PENDIENTES - MEDIOS

### 6. **Cronómetro y Temporizador - Debe poder arrastrarse**
- **Problema**: Los elementos stopwatch y countdown no son arrastrables
- **Archivos**: 
  - `src/components/canvas/elements/stopwatch-element.tsx`
  - `src/components/canvas/elements/countdown-element.tsx`
- **Estado**: ⚠️ PENDIENTE VERIFICAR
- **Prioridad**: MEDIA

### 7. **Paleta de color para fondo (Botón Texto)**
- **Estado**: Parcialmente implementado
- **Archivo**: `src/components/canvas/tools-sidebar.tsx`
- **Línea**: ~472-480
- **Problema**: Popover agregado pero necesita verificar que funcione
- **Prioridad**: BAJA

### 8. **Botón Enlace - Campo de texto**
- **Estado**: Mejorado con Dialog
- **Archivo**: `src/components/canvas/formatting-toolbar.tsx`
- **Verificar**: Que funcione correctamente
- **Prioridad**: BAJA

---

## 🔵 MEJORAS Y VERIFICACIONES

### 9. **Cursor en otros elementos editables**
- **text-element.tsx** - ✅ Parcialmente corregido (verificación `isFocused` agregada)
- **sticky-note-element.tsx** - ✅ Parcialmente corregido (verificación `isFocused` agregada)
- **notepad-element.tsx** - ✅ Parcialmente corregido (verificación `isFocused` agregada)
- **tabbed-notepad-element.tsx** - ✅ CORREGIDO HOY

### 10. **Abuso de `any` en tipos**
- **Archivos afectados**: 25 archivos
- `src/lib/types.ts` - `properties?: any`, `content?: any`
- `src/hooks/use-element-manager.ts` - `const stickyElement: any`
- `src/lib/store/boardStore.ts` - `(boardData as any).userId`
- **Impacto**: Errores silenciosos en runtime, pérdida de autocompletado
- **Prioridad**: MEDIA (mejora de calidad de código)

---

## 📝 NOTAS

- **Dictado**: Simplificado según Readme 18 Nov - implementación simple y directa
- **Export PNG**: Mejorado para capturar solo área visible del viewport
- **Botón Pincel**: Corregido para que el color persista correctamente
- **Cursor**: Corregido en tabbed-notepad, otros elementos parcialmente corregidos

---

**Total de tareas pendientes**: 8  
**Total de tareas completadas hoy**: 4

