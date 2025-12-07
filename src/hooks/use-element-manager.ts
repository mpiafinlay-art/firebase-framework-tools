
'use client';

import { useCallback, useRef, useEffect } from 'react';
import { useFirestore, useUser } from '@/firebase/provider';
import {
  collection,
  doc,
  updateDoc,
  serverTimestamp,
  writeBatch,
  addDoc,
  deleteDoc,
  getDoc,
} from 'firebase/firestore';
import type { ElementType, CanvasElement, WithId, CanvasElementProperties, ContainerContent, StickyCanvasElement, ElementContent } from '@/lib/types';
import { startOfWeek } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export function useElementManager(boardId: string, getViewportCenter: () => { x: number, y: number }, getNextZIndex: (baseElementId?: string) => number) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  // CRÍTICO: Usar refs para funciones que pueden cambiar frecuentemente
  // Esto previene re-creaciones constantes de addElement
  const getViewportCenterRef = useRef(getViewportCenter);
  const getNextZIndexRef = useRef(getNextZIndex);

  // Actualizar refs cuando cambian
  useEffect(() => {
    getViewportCenterRef.current = getViewportCenter;
    getNextZIndexRef.current = getNextZIndex;
  }, [getViewportCenter, getNextZIndex]);

  const addElement = useCallback(async (type: ElementType, props?: { color?: string; content?: ElementContent; properties?: CanvasElementProperties; parentId?: string; tags?: string[] }): Promise<string> => {
    if (!firestore || !user || !boardId) {
      const errorMsg = !firestore ? 'Firestore no está disponible' : !user ? 'Usuario no autenticado' : 'Board ID no válido';
      return Promise.reject(new Error(errorMsg));
    }
    const elementsRef = collection(firestore, 'users', user.uid, 'canvasBoards', boardId, 'canvasElements');
    if (type === 'connector') {
      const docRef = await addDoc(elementsRef, {
        type: 'connector',
        userId: user.uid,
        properties: {},
        content: props?.content,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    }

    const defaultPosition = getViewportCenterRef.current(); // ✅ Usar ref
    
    // REGLA: Los nuevos elementos deben aparecer en PRIMERA CAPA (zIndex máximo)
    // para que el usuario pueda arrastrarlos y reubicarlos fácilmente
    // EXCEPCIÓN CRÍTICA: Los contenedores SIEMPRE están en la primera capa (zIndex 0)
    // incluso antes que cuadernos, para que puedan recibir elementos arrastrados
    let zIndex;
    if (type === 'container') {
        zIndex = 0; // Contenedores siempre en primera capa (zIndex 0)
    } else {
        // Todos los demás elementos nuevos van a la PRIMERA CAPA (zIndex máximo + 1)
        zIndex = getNextZIndexRef.current(); // ✅ Usar ref
    }

    // REGLA #1: Los elementos se abren centrados en el viewport del usuario
    // Si no se proporciona una posición específica, usar el centro del viewport
    // IMPORTANTE: Verificar que props existe antes de acceder a properties
    const viewportCenter = (props && props.properties && props.properties.position) 
      ? props.properties.position 
      : defaultPosition;
    const baseSize = (props && props.properties && props.properties.size)
      ? props.properties.size
      : { width: 200, height: 150 };
    const sizeWidth = typeof baseSize.width === 'number' ? baseSize.width : 200;
    const sizeHeight = typeof baseSize.height === 'number' ? baseSize.height : 150;

    // Helper: Calcula la posición para centrar el elemento en el viewport VISIBLE
    // REGLA CRÍTICA: Los elementos deben aparecer en el ESPACIO VISIBLE del usuario
    // El elemento debe estar centrado en el área visible del tablero
    const getCenteredPosition = (width: number, height: number) => {
      // Obtener el centro del viewport visible (ya calculado con scroll y scale)
      const centerX = viewportCenter.x;
      const centerY = viewportCenter.y;
      
      // Calcular posición centrada ideal (centro del elemento = centro del viewport visible)
      let x = centerX - (width / 2);
      let y = centerY - (height / 2);
      
      // CRÍTICO: Asegurar que el elemento aparezca SIEMPRE en el área visible
      // Si el cálculo da negativo, ajustar para que al menos parte del elemento sea visible
      // Mínimo: asegurar que la esquina superior izquierda esté dentro del viewport visible
      const minOffset = 20; // Margen mínimo desde el borde visible
      
      // Obtener dimensiones del viewport en coordenadas del canvas
      const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
      const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;
      
      // Asegurar que el elemento quede dentro del área visible del viewport
      // Si el elemento es más pequeño que el viewport, centrarlo
      // Si es más grande, asegurar que al menos parte sea visible
      if (width <= viewportWidth) {
        // Elemento cabe en el viewport: centrarlo
        x = Math.max(minOffset, Math.min(x, centerX + viewportWidth / 2 - width));
      } else {
        // Elemento más grande que el viewport: alinear para que sea visible desde el inicio
        x = Math.max(minOffset, centerX - viewportWidth / 4);
      }
      
      if (height <= viewportHeight) {
        // Elemento cabe en el viewport: centrarlo
        y = Math.max(minOffset, Math.min(y, centerY + viewportHeight / 2 - height));
      } else {
        // Elemento más grande que el viewport: alinear para que sea visible desde el inicio
        y = Math.max(minOffset, centerY - viewportHeight / 4);
      }
      
      // Verificación final: NUNCA permitir coordenadas negativas
      return { 
        x: Math.max(0, x), 
        y: Math.max(0, y)
      };
    };

    // Construir baseProperties de forma segura
    const baseProperties: Partial<CanvasElementProperties> = {
      size: baseSize,
      zIndex: zIndex,
      rotation: 0,
    };
    
    // Agregar propiedades adicionales de props si existen
    if (props && props.properties && typeof props.properties === 'object') {
      Object.assign(baseProperties, props.properties);
    }

    let newElementData: Omit<WithId<CanvasElement>, 'id'> & { type: ElementType };

    switch (type) {
      case 'notepad':
        const notepadSize = { width: 794, height: 978 };
        const notepadPos = getCenteredPosition(notepadSize.width, notepadSize.height);
        newElementData = { type, x: notepadPos.x, y: notepadPos.y, width: notepadSize.width, height: notepadSize.height, userId: user.uid, properties: { ...baseProperties, position: notepadPos, size: notepadSize, format: 'letter' }, content: { title: 'Nuevo Cuaderno', pages: Array(5).fill('<div><br></div>'), currentPage: 0 }, zIndex, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }; break;
      case 'notepad-simple':
        const notepadSimpleSize = { width: 302, height: 491 };
        const notepadSimplePos = getCenteredPosition(notepadSimpleSize.width, notepadSimpleSize.height);
        newElementData = { type, x: notepadSimplePos.x, y: notepadSimplePos.y, width: notepadSimpleSize.width, height: notepadSimpleSize.height, userId: user.uid, properties: { ...baseProperties, position: notepadSimplePos, size: notepadSimpleSize }, content: { title: 'Nuevo Notepad', text: '<div><br></div>' }, zIndex, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }; break;
      case 'super-notebook':
        // Tamaño exacto: 21cm x 27cm (794px x 1021px a 96 DPI)
        const superNotebookSize = { width: 794, height: 1021 };
        const superNotebookPos = getCenteredPosition(superNotebookSize.width, superNotebookSize.height);
        newElementData = { type, x: superNotebookPos.x, y: superNotebookPos.y, width: superNotebookSize.width, height: superNotebookSize.height, userId: user.uid, properties: { ...baseProperties, position: superNotebookPos, size: superNotebookSize }, content: { title: 'Super Cuaderno', pages: Array(5).fill('<div><br></div>'), currentPage: 0 }, zIndex, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }; break;
      case 'sticky':
        const stickyColor = props?.color || 'yellow';
        const stickySize = { width: 224, height: 224 };
        const stickyPos = getCenteredPosition(stickySize.width, stickySize.height);
        const stickyElement: Omit<StickyCanvasElement, 'id'> = { 
          type: 'sticky', 
          x: stickyPos.x, 
          y: stickyPos.y, 
          width: stickySize.width, 
          height: stickySize.height, 
          userId: user.uid, 
          properties: { ...baseProperties, position: stickyPos, size: stickySize, color: stickyColor } as CanvasElementProperties, 
          content: (typeof props?.content === 'string' ? props.content : 'Escribe algo...'), 
          zIndex, 
          createdAt: serverTimestamp(), 
          updatedAt: serverTimestamp(),
          ...(props?.tags && { tags: props.tags }),
        };
        newElementData = stickyElement; break;
      case 'todo':
        const todoSize = { width: 300, height: 150 };
        const todoPos = getCenteredPosition(todoSize.width, todoSize.height);
        newElementData = { type, x: todoPos.x, y: todoPos.y, width: todoSize.width, height: todoSize.height, userId: user.uid, properties: { ...baseProperties, position: todoPos, size: todoSize }, content: props?.content || { title: 'Lista de Tareas', items: [] }, zIndex, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }; break;
      case 'image':
        const imagePos = getCenteredPosition(sizeWidth, sizeHeight);
        newElementData = { type, x: imagePos.x, y: imagePos.y, width: sizeWidth, height: sizeHeight, userId: user.uid, properties: { ...baseProperties, position: imagePos, size: { width: sizeWidth, height: sizeHeight } }, content: props?.content, zIndex, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }; break;
      case 'text':
        const textPos = getCenteredPosition(sizeWidth, sizeHeight);
        const textBgColor = (props?.properties as CanvasElementProperties)?.backgroundColor || '#ffffff';
        newElementData = { type, x: textPos.x, y: textPos.y, width: sizeWidth, height: sizeHeight, userId: user.uid, properties: { ...baseProperties, position: textPos, size: { width: sizeWidth, height: sizeHeight }, backgroundColor: textBgColor }, content: props?.content || '<div style="font-size: 18px;">Escribe algo...</div>', color: props?.color || 'white', zIndex, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }; break;
      case 'container':
        // REGLA ESPECIAL: Elemento K85hC8M5spfsgRITnEQR (lienzo) debe ser 60% más pequeño y color #daf4c5
        const defaultContainerSize = { width: 378, height: 567 }; // 10x15 cm en píxeles
        const containerSize = (props?.properties?.size) 
          ? props.properties.size 
          : defaultContainerSize;
        // Si es el lienzo especial (título "Lienzo" o ID específico), reducir ancho 50%
        const containerContent = props?.content && typeof props.content === 'object' && 'title' in props.content 
          ? (props.content as any) 
          : null;
        const isSpecialLienzo = containerContent?.title === 'Lienzo' || containerContent?.title === 'lienzo';
        const finalContainerSize = isSpecialLienzo 
          ? { width: Math.round((typeof containerSize.width === 'number' ? containerSize.width : 378) * 0.5), height: typeof containerSize.height === 'number' ? containerSize.height : 567 }
          : containerSize;
        const containerPos = getCenteredPosition(typeof finalContainerSize.width === 'number' ? finalContainerSize.width : 378, typeof finalContainerSize.height === 'number' ? finalContainerSize.height : 567);
        const containerBackgroundColor = isSpecialLienzo
          ? '#daf4c5' // Color especial para lienzo
          : ((props?.properties?.backgroundColor) 
            ? props.properties.backgroundColor 
            : 'white');
        // REGLA: Lienzo debe tener zIndex = -1 (debajo de todos excepto cuadernos que tienen zIndex = 1)
        const containerZIndex = isSpecialLienzo ? -1 : zIndex;
        const finalContainerContent = containerContent || { title: 'Nuevo Contenedor', elementIds: [], layout: 'single' };
        newElementData = { type: 'container', x: containerPos.x, y: containerPos.y, width: typeof finalContainerSize.width === 'number' ? finalContainerSize.width : 378, height: typeof finalContainerSize.height === 'number' ? finalContainerSize.height : 567, userId: user.uid, properties: { ...baseProperties, position: containerPos, size: finalContainerSize, backgroundColor: containerBackgroundColor, zIndex: containerZIndex }, content: finalContainerContent, zIndex: containerZIndex, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }; break;
      case 'comment':
        const commentSize = { width: 32, height: 32 };
        const commentPos = getCenteredPosition(commentSize.width, commentSize.height);
        newElementData = { type, x: commentPos.x, y: commentPos.y, width: commentSize.width, height: commentSize.height, userId: user.uid, properties: { ...baseProperties, position: commentPos, size: commentSize }, content: props?.content || { title: '', label: '', comment: '' }, parentId: props?.parentId || undefined, zIndex, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }; break;
      case 'moodboard':
        const moodboardSize = { width: 600, height: 500 };
        const moodboardPos = getCenteredPosition(moodboardSize.width, moodboardSize.height);
        newElementData = { type, x: moodboardPos.x, y: moodboardPos.y, width: moodboardSize.width, height: moodboardSize.height, userId: user.uid, properties: { ...baseProperties, position: moodboardPos, size: moodboardSize, backgroundColor: '#ffffff' }, content: props?.content || { title: 'Nuevo Moodboard', images: [], annotations: [], layout: 'grid' }, zIndex, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }; break;
      case 'tabbed-notepad':
        const tabbedSize = { width: 500, height: 400 };
        const tabbedPos = getCenteredPosition(tabbedSize.width, tabbedSize.height);
        newElementData = { type, x: tabbedPos.x, y: tabbedPos.y, width: tabbedSize.width, height: tabbedSize.height, userId: user.uid, properties: { ...baseProperties, position: tabbedPos, size: tabbedSize, backgroundColor: '#ffffff' }, content: props?.content || { title: 'Bloc de Notas', tabs: [{ id: 'tab-1', title: 'Pestaña 1', content: '' }], activeTabId: 'tab-1' }, zIndex, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }; break;
      case 'accordion':
        const accordionSize = { width: 320, height: 240 }; // 20% más pequeño que 400x300
        const accordionPos = getCenteredPosition(accordionSize.width, accordionSize.height);
        newElementData = { type, x: accordionPos.x, y: accordionPos.y, width: accordionSize.width, height: accordionSize.height, userId: user.uid, properties: { ...baseProperties, position: accordionPos, size: accordionSize, backgroundColor: '#ffffff' }, content: props?.content || { items: [{ id: '1', title: 'Nuevo Item', content: '' }] }, zIndex, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }; break;
      case 'stopwatch':
        const stopwatchSize = { width: 200, height: 120 };
        const stopwatchPos = getCenteredPosition(stopwatchSize.width, stopwatchSize.height);
        newElementData = { type: 'stopwatch' as ElementType, x: stopwatchPos.x, y: stopwatchPos.y, width: stopwatchSize.width, height: stopwatchSize.height, userId: user.uid, properties: { ...baseProperties, position: stopwatchPos, size: stopwatchSize, backgroundColor: '#000000' }, content: { time: 0, isRunning: false }, zIndex, createdAt: serverTimestamp(), updatedAt: serverTimestamp() } as Omit<WithId<CanvasElement>, 'id'> & { type: ElementType }; break;
      case 'countdown':
        const countdownSize = { width: 200, height: 180 };
        const countdownPos = getCenteredPosition(countdownSize.width, countdownSize.height);
        newElementData = { type: 'countdown' as ElementType, x: countdownPos.x, y: countdownPos.y, width: countdownSize.width, height: countdownSize.height, userId: user.uid, properties: { ...baseProperties, position: countdownPos, size: countdownSize, backgroundColor: '#000000' }, content: { timeLeft: 0, selectedMinutes: 5, isRunning: false }, zIndex, createdAt: serverTimestamp(), updatedAt: serverTimestamp() } as Omit<WithId<CanvasElement>, 'id'> & { type: ElementType }; break;
      case 'highlight-text':
        const highlightSize = { width: 300, height: 150 };
        const highlightPos = getCenteredPosition(highlightSize.width, highlightSize.height);
        const highlightColor = (props?.properties?.backgroundColor) ? props.properties.backgroundColor : '#fffb8b';
        newElementData = { type: 'highlight-text' as ElementType, x: highlightPos.x, y: highlightPos.y, width: highlightSize.width, height: highlightSize.height, userId: user.uid, properties: { ...baseProperties, position: highlightPos, size: highlightSize, backgroundColor: highlightColor }, content: { text: '' }, zIndex, createdAt: serverTimestamp(), updatedAt: serverTimestamp() } as Omit<WithId<CanvasElement>, 'id'> & { type: ElementType }; break;
      case 'yellow-notepad':
        // Tamaño basado en las imágenes: aproximadamente 400x600px (portrait)
        const yellowNotepadSize = { width: 400, height: 600 };
        const yellowNotepadPos = getCenteredPosition(yellowNotepadSize.width, yellowNotepadSize.height);
        newElementData = { type, x: yellowNotepadPos.x, y: yellowNotepadPos.y, width: yellowNotepadSize.width, height: yellowNotepadSize.height, userId: user.uid, properties: { ...baseProperties, position: yellowNotepadPos, size: yellowNotepadSize, backgroundColor: '#FFFFE0' }, content: props?.content || { text: '', searchQuery: '' }, zIndex, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }; break;
      default: return Promise.reject(new Error(`Tipo de elemento inválido: ${type}`));
    }
  
    const docRef = await addDoc(elementsRef, newElementData);
    return docRef.id;
  }, [firestore, user, boardId]); // ✅ Removido getNextZIndex y getViewportCenter - usar directamente sin dependencias

  const updateElement = useCallback((id: string, updates: Partial<CanvasElement>) => {
    if (!firestore || !user || !boardId) return;
    const elementDocRef = doc(firestore, 'users', user.uid, 'canvasBoards', boardId, 'canvasElements', id);
    
    // Limpiar valores undefined (Firestore no los acepta)
    const cleanUpdates: any = { updatedAt: serverTimestamp() };
    Object.keys(updates).forEach(key => {
      const value = (updates as any)[key];
      if (value !== undefined) {
        cleanUpdates[key] = value;
      } else if (key === 'parentId') {
        // Si parentId es undefined, usar null para eliminarlo
        cleanUpdates[key] = null;
      }
    });
    
    // Actualizar el elemento
    updateDoc(elementDocRef, cleanUpdates);
    
    // AUTOGUARDADO DEL TABLERO: Actualizar también el tablero con updatedAt
    // Esto asegura que el tablero refleje siempre la última modificación
    const boardDocRef = doc(firestore, 'users', user.uid, 'canvasBoards', boardId);
    updateDoc(boardDocRef, { updatedAt: serverTimestamp() }).catch(err => {
      console.error('Error actualizando tablero:', err);
    });
  }, [firestore, user, boardId]);

  const deleteElement = useCallback(async (id: string, allElements: WithId<CanvasElement>[]) => {
    if (!firestore || !user || !boardId) return;
    
    const elementToDeleteRef = allElements.find(el => el.id === id);
    if (!elementToDeleteRef) return;

    const elementsRef = collection(firestore, 'users', user.uid, 'canvasBoards', boardId, 'canvasElements');
    const batch = writeBatch(firestore);
    const elementDocRef = doc(elementsRef, id);

    if (elementToDeleteRef.type === 'container') {
        const containerContent = elementToDeleteRef.content as ContainerContent;
        if (containerContent && Array.isArray(containerContent.elementIds)) {
            containerContent.elementIds.forEach((childId: string) => {
                const childDocRef = doc(elementsRef, childId);
                batch.delete(childDocRef);
            });
        }
    }
    
    batch.delete(elementDocRef);

    await batch.commit();
  }, [firestore, user, boardId]);

  const unanchorElement = useCallback(async (elementId: string) => {
    if (!firestore || !user || !boardId) return;

    const elementsRef = collection(firestore, 'users', user.uid, 'canvasBoards', boardId, 'canvasElements');
    const elementDocRef = doc(elementsRef, elementId);
    
    const elementSnap = await getDoc(elementDocRef);
    if (!elementSnap.exists()) {
      toast({ 
        variant: 'destructive',
        title: "Error", 
        description: "El elemento no existe." 
      });
      return;
    }
    
    const elementData = elementSnap.data();
    if (!elementData?.parentId) {
      toast({ 
        variant: 'destructive',
        title: "Error", 
        description: "El elemento no está anclado a ningún contenedor." 
      });
      return;
    }

    const element = elementData as CanvasElement;
    const parentId = element.parentId;
    const parentDocRef = doc(elementsRef, parentId);
    const parentSnap = await getDoc(parentDocRef);

    if (!parentSnap.exists()) {
      toast({ 
        variant: 'destructive',
        title: "Error", 
        description: "No se encontró el contenedor padre." 
      });
      return;
    }

    const parentElementData = parentSnap.data();
    if (!parentElementData) {
      toast({ 
        variant: 'destructive',
        title: "Error", 
        description: "No se pudo obtener datos del contenedor padre." 
      });
      return;
    }

    const parentElement = parentElementData as CanvasElement;
    const parentContent = parentElement?.content as ContainerContent | undefined;
    const parentProps = parentElement?.properties as CanvasElementProperties | undefined;

    // Remove elementId from parent's content
    const newElementIds = (parentContent?.elementIds || []).filter(id => id !== elementId);

    // Calcular nueva posición mejorada: a la derecha del panel con un offset
    const parentX = parentProps?.position?.x ?? 0;
    const parentWidth = typeof parentProps?.size?.width === 'number' 
      ? parentProps.size.width 
      : (parentProps?.size?.width ? parseFloat(String(parentProps.size.width)) : 300) || 300;
    const parentY = parentProps?.position?.y ?? 0;
    
    // Obtener posición original del elemento si existe, o calcular nueva
    const elementProps = element.properties as CanvasElementProperties | undefined;
    const originalPosition = elementProps?.position || { x: element.x || 0, y: element.y || 0 };
    
    // Si el elemento tenía una posición original válida, intentar restaurarla
    // Si no, colocar a la derecha del panel
    const newPosition = originalPosition.x > 0 && originalPosition.y > 0
      ? originalPosition // Restaurar posición original
      : {
          x: parentX + parentWidth + 20, // A la derecha del panel con 20px de margen
          y: parentY + 50, // Ligeramente abajo del panel
        };

    const batch = writeBatch(firestore);
    
    // Update parent
    batch.update(parentDocRef, { 
      content: { ...parentContent, elementIds: newElementIds },
      updatedAt: serverTimestamp(),
    });
    
    // Update child - restaurar propiedades completas y asegurar visibilidad
    const safeProperties = elementProps || {};
    const elementSize = typeof element.width === 'number' && typeof element.height === 'number'
      ? { width: element.width, height: element.height }
      : (safeProperties.size || { width: 200, height: 150 });
    
    batch.update(elementDocRef, {
        parentId: null,
        hidden: false,
        x: newPosition.x,
        y: newPosition.y,
        properties: {
          ...safeProperties,
          position: newPosition,
          size: elementSize,
        },
        updatedAt: serverTimestamp(),
    });

    try {
      await batch.commit();
      toast({ 
        title: "Elemento desanclado", 
        description: "El elemento ha sido devuelto al lienzo." 
      });
    } catch (error) {
      console.error('Error al desanclar elemento:', error);
      toast({ 
        variant: 'destructive',
        title: "Error", 
        description: "No se pudo desanclar el elemento." 
      });
    }
  }, [firestore, user, boardId, toast]);

  return { addElement, updateElement, deleteElement, unanchorElement };
}
