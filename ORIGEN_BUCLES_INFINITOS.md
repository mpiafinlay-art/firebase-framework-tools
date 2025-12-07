# 🔴 ORIGEN DE BUCLES INFINITOS AL TOCAR CÓDIGO

## PROBLEMA CRÍTICO IDENTIFICADO

### Flujo que causa bucles infinitos:

1. **Código se modifica** → Hot Module Replacement (HMR) de Next.js
2. **React re-renderiza componentes** → Todos los hooks se re-ejecutan
3. **`foundElement` se recalcula** → Depende de `elements` completo (línea 244)
4. **`useEffect` actualiza `selectedElement`** → Línea 247
5. **Otros `useEffect` se disparan** → Dependen de `selectedElement`
6. **Listener de Firestore se dispara** → Actualiza `elements`
7. **`elements` cambia** → Vuelve al paso 3
8. **LOOP INFINITO** → Bugs en cascada

## 🔴 BUGS ESPECÍFICOS:

### 1. **foundElement depende de `elements` completo**
**Archivo**: `src/app/board/[boardId]/page.tsx` línea 241-244
```typescript
const foundElement = useMemo(() => {
  if (!selectedElementId || !elements || elements.length === 0) return null;
  return elements.find(el => el.id === selectedElementId) || null;
}, [selectedElementId, elements]); // ⚠️ PROBLEMA: elements completo cambia constantemente
```

**Problema**: 
- Cada vez que Firestore actualiza `elements` (incluso sin cambios reales), `foundElement` se recalcula
- Si el elemento encontrado es diferente (nueva referencia), `selectedElement` se actualiza
- Esto dispara efectos en cascada

### 2. **Comparación en listener puede fallar**
**Archivo**: `src/lib/store/boardStore.ts` línea 110-111
```typescript
const hasChanged = currentElements.length !== newElements.length || 
  currentElements.some((el, idx) => el.id !== newElements[idx]?.id || el.updatedAt !== newElements[idx]?.updatedAt);
```

**Problema**:
- Compara por índice, pero si el orden cambia, detecta cambios falsos
- `updatedAt` puede cambiar incluso sin cambios reales (serverTimestamp)
- Puede actualizar cuando no debería

### 3. **useEffect que actualiza selectedElement sin verificación**
**Archivo**: `src/app/board/[boardId]/page.tsx` línea 246-248
```typescript
useEffect(() => {
  setSelectedElement(foundElement);
}, [foundElement]);
```

**Problema**:
- Si `foundElement` cambia de referencia (mismo objeto, nueva instancia), actualiza estado
- Esto dispara otros efectos que dependen de `selectedElement`

### 4. **Hot Module Replacement (HMR) agrava el problema**
- Cuando se modifica código, HMR re-ejecuta todos los hooks
- Si hay dependencias inestables, se crean loops
- El listener de Firestore puede dispararse múltiples veces durante HMR

## ✅ SOLUCIONES:

### 1. **foundElement debe comparar por ID, no por referencia**
```typescript
const foundElement = useMemo(() => {
  if (!selectedElementId || !elements || elements.length === 0) return null;
  return elements.find(el => el.id === selectedElementId) || null;
}, [selectedElementId, elements.length, selectedElementId ? elements.find(e => e.id === selectedElementId)?.updatedAt : null]);
```

O mejor:
```typescript
const foundElementIdRef = useRef<string | null>(null);
const foundElement = useMemo(() => {
  if (!selectedElementId || !elements || elements.length === 0) {
    foundElementIdRef.current = null;
    return null;
  }
  const found = elements.find(el => el.id === selectedElementId) || null;
  // Solo actualizar si el ID cambió o el elemento realmente cambió
  if (found && (foundElementIdRef.current !== found.id || found !== selectedElement)) {
    foundElementIdRef.current = found.id;
    return found;
  }
  return found;
}, [selectedElementId, elements]);
```

### 2. **Comparación en listener debe ser más robusta**
```typescript
// Comparar por IDs y contenido, no por índice
const hasChanged = currentElements.length !== newElements.length || 
  currentElements.some((el) => {
    const newEl = newElements.find(ne => ne.id === el.id);
    if (!newEl) return true; // Elemento eliminado
    // Comparar solo campos relevantes, no updatedAt (cambia siempre)
    return el.content !== newEl.content || 
           JSON.stringify(el.properties) !== JSON.stringify(newEl.properties);
  });
```

### 3. **useEffect debe verificar si realmente cambió**
```typescript
useEffect(() => {
  // Solo actualizar si realmente cambió (comparar por ID)
  if (foundElement?.id !== selectedElement?.id) {
    setSelectedElement(foundElement);
  }
}, [foundElement?.id, selectedElement?.id]); // Depender solo de IDs
```

### 4. **Deshabilitar HMR en desarrollo crítico**
O usar `React.StrictMode` solo en producción para evitar doble renderizado

