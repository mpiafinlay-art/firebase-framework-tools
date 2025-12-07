# 🔴 BUGS EN CASCADA AL CREAR ELEMENTOS - CAUSA RAÍZ

## PROBLEMA CRÍTICO IDENTIFICADO

### Flujo que causa bugs en cascada:

1. **Usuario crea elemento** → `addElement()` se llama
2. **addDoc en Firestore** → Crea documento en Firestore
3. **Listener onSnapshot se dispara** → `boardStore.ts` línea 101
4. **Estado `elements` se actualiza** → Store actualiza `elements`
5. **page.tsx recibe nuevo `elements`** → Línea 95
6. **`getNextZIndex` se recalcula** → Línea 224 (depende de `elements`)
7. **`useElementManager` recibe nuevo `getNextZIndex`** → Línea 226
8. **`addElement` se recrea** → useCallback se recalcula
9. **Si hay useEffect que depende de `addElement`** → Se dispara de nuevo
10. **LOOP INFINITO** → Bugs en cascada

## 🔴 BUGS ESPECÍFICOS ENCONTRADOS:

### 1. **getNextZIndex depende de `elements` completo**
**Archivo**: `src/app/board/[boardId]/page.tsx` línea 224
```typescript
const getNextZIndex = useCallback(() => {
  if (!elements || elements.length === 0) return 1;
  const zIndexes = elements
    .filter(e => typeof e.zIndex === 'number')
    .map(e => e.zIndex!);
  return zIndexes.length > 0 ? Math.max(...zIndexes) + 1 : 2;
}, [elements]); // ⚠️ PROBLEMA: Depende de elements completo
```

**Problema**: Cada vez que se crea un elemento, `elements` cambia → `getNextZIndex` se recrea → `addElement` se recrea → Posibles loops

### 2. **useElementManager recibe funciones que cambian**
**Archivo**: `src/app/board/[boardId]/page.tsx` línea 226
```typescript
const { addElement } = useElementManager(boardId, getViewportCenter, getNextZIndex);
```

**Problema**: `getNextZIndex` cambia cada vez que `elements` cambia, causando que `useElementManager` se recalcule

### 3. **Listener onSnapshot dispara actualizaciones múltiples**
**Archivo**: `src/lib/store/boardStore.ts` línea 101
```typescript
unsubscribe = onSnapshot(
  elementsQuery,
  (snapshot) => {
    const elements = snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    } as WithId<CanvasElement>));
    set({ elements, isLoading: false }); // ⚠️ Actualiza todo el estado
  },
```

**Problema**: Cada vez que se crea un elemento, el listener actualiza TODO el array `elements`, causando re-renders en cascada

### 4. **useMemo depende de elements.length pero usa elements completo**
**Archivo**: `src/app/board/[boardId]/page.tsx` línea 234
```typescript
const foundElement = useMemo(() => {
  if (!selectedElementId || !elements || elements.length === 0) return null;
  return elements.find(el => el.id === selectedElementId) || null;
}, [selectedElementId, elements.length]); // ⚠️ Solo length, pero usa elements completo
```

**Problema**: Si `elements` cambia pero `length` no, el useMemo no se recalcula pero puede tener datos obsoletos

## ✅ SOLUCIONES PROPUESTAS:

### 1. **getNextZIndex debe usar ref o memoizar mejor**
```typescript
const getNextZIndex = useCallback(() => {
  if (!elements || elements.length === 0) return 1;
  const zIndexes = elements
    .filter(e => typeof e.zIndex === 'number')
    .map(e => e.zIndex!);
  return zIndexes.length > 0 ? Math.max(...zIndexes) + 1 : 2;
}, [elements.length]); // Solo depender de length, no del array completo
```

### 2. **useElementManager debe usar refs para funciones**
Ya está implementado parcialmente (líneas 27-34), pero `getNextZIndex` aún se pasa como parámetro

### 3. **Listener debe actualizar solo elementos nuevos**
En lugar de actualizar todo el array, usar merge o actualización incremental

### 4. **useMemo debe depender correctamente**
```typescript
const foundElement = useMemo(() => {
  if (!selectedElementId || !elements || elements.length === 0) return null;
  return elements.find(el => el.id === selectedElementId) || null;
}, [selectedElementId, elements]); // Depender del array completo O usar otra estrategia
```

## 🎯 PRIORIDAD:

1. **CRÍTICO**: Arreglar `getNextZIndex` para que no dependa de `elements` completo
2. **CRÍTICO**: Usar refs en `useElementManager` para `getNextZIndex`
3. **ALTO**: Optimizar listener para actualizaciones incrementales
4. **MEDIO**: Corregir dependencias de useMemo

