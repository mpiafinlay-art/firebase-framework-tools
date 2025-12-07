'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

// Hooks y Contextos
import { useAuth, useUser, useStorage } from '@/firebase/provider';
import { useBoardStore } from '@/lib/store/boardStore';
import { useBoardState } from '@/hooks/use-board-state';
import { useElementManager } from '@/hooks/use-element-manager';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useToast } from '@/hooks/use-toast';

// Utilidades y Tipos
import { uploadFile } from '@/lib/upload-helper';
import { WithId, CanvasElement, Board, ElementType, ElementContent, CanvasElementProperties } from '@/lib/types';
import html2canvas from 'html2canvas';

// Componentes de UI
import { Button } from '@/components/ui/button';

// Componentes del Canvas
import Canvas from '@/components/canvas/canvas';
import ToolsSidebar from '@/components/canvas/tools-sidebar';
import FormattingToolbar from '@/components/canvas/formatting-toolbar';
// Diálogos
import AddImageFromUrlDialog from '@/components/canvas/elements/add-image-from-url-dialog';
import ChangeFormatDialog from '@/components/canvas/change-format-dialog';
import EditCommentDialog from '@/components/canvas/elements/edit-comment-dialog';
import ElementInfoPanel from '@/components/canvas/element-info-panel';
import RenameBoardDialog from '@/components/canvas/rename-board-dialog';
// Hook de dictado
import { useDictation } from '@/hooks/use-dictation';

interface BoardPageProps {
  params: {
    boardId: string;
  };
}

export default function BoardPage({ params }: BoardPageProps) {
  const { boardId } = params;
  const router = useRouter();
  const { user, isUserLoading: authLoading, userError } = useUser();
  const storage = useStorage();
  const { toast } = useToast();
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  // DEBUG: Log inmediato al inicio del componente
  console.log('🎯 [BoardPage] Componente iniciado', {
    boardId,
    hasUser: !!user,
    userId: user?.uid,
    isAnonymous: user?.isAnonymous,
    authLoading,
    pathname: typeof window !== 'undefined' ? window.location.pathname : 'SSR'
  });
  
  // CRÍTICO: Usar refs para funciones de Zustand y toast para evitar bucles infinitos
  const loadBoardRef = useRef<any>(null);
  const createBoardRef = useRef<any>(null);
  const cleanupRef = useRef<any>(null);
  const toastRef = useRef(toast);
  
  // Actualizar refs cuando cambian
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);
  
  // DEBUG: Log cuando el componente se monta
  React.useEffect(() => {
    console.log('🚀 [BoardPage] Componente montado', { boardId });
  }, [boardId]);
  
  // DEBUG: Log del estado del usuario
  React.useEffect(() => {
    console.log('🔍 [BoardPage] Estado del usuario:', {
      hasUser: !!user,
      userId: user?.uid,
      isUserLoading: authLoading,
      userError: userError?.message,
      userEmail: user?.email,
      isAnonymous: user?.isAnonymous,
      sessionStorage: typeof window !== 'undefined' ? {
        hasRecentLogin: sessionStorage.getItem('hasRecentLogin'),
        loginTimestamp: sessionStorage.getItem('loginTimestamp'),
        redirectingToBoard: sessionStorage.getItem('redirectingToBoard')
      } : 'N/A (SSR)'
    });
  }, [user, authLoading, userError]);

  // -- ESTADO GLOBAL DEL TABLERO (Zustand) --
  const {
    elements,
    board,
    loadBoard,
    createBoard,
    updateElement,
    deleteElement,
    selectedElementIds,
    setSelectedElementIds,
    isLoading: isBoardLoading,
    error,
    cleanup,
  } = useBoardStore();
  
  // CRÍTICO: Actualizar refs cuando las funciones de Zustand cambian
  useEffect(() => {
    loadBoardRef.current = loadBoard;
    createBoardRef.current = createBoard;
    cleanupRef.current = cleanup;
  }, [loadBoard, createBoard, cleanup]);

  // -- ESTADO LOCAL Y HOOKS --
  // CRÍTICO: useBoardState crea listeners DUPLICADOS de Firebase para elements
  // Solo usar para boards, handleRenameBoard, handleDeleteBoard, clearCanvas
  // NO usar elements de useBoardState - usar solo de useBoardStore
  const { boards, handleRenameBoard, handleDeleteBoard, clearCanvas } = useBoardState(boardId);
  const canvasRef = useRef<any>(null);
  
  // Wrapper functions para coincidir con los tipos esperados
  const handleRenameBoardWrapper = useCallback(() => {
    setIsRenameBoardDialogOpen(true);
  }, []);
  
  const handleSaveRenameBoard = useCallback((newName: string) => {
    handleRenameBoard(newName);
    setIsRenameBoardDialogOpen(false);
  }, [handleRenameBoard]);
  
  const clearCanvasWrapper = useCallback(() => {
    clearCanvas(elements);
  }, [elements, clearCanvas]);

  // Estados de UI
  const [isFormatToolbarOpen, setIsFormatToolbarOpen] = useState(true);
  const [isImageUrlDialogOpen, setIsImageUrlDialogOpen] = useState(false);
  const [changeFormatDialogOpen, setChangeFormatDialogOpen] = useState(false);
  const [isPanningActive, setIsPanningActive] = useState(false);
  const [isRenameBoardDialogOpen, setIsRenameBoardDialogOpen] = useState(false);
  
  // Estados de Selección y Edición
  const [selectedElement, setSelectedElement] = useState<WithId<CanvasElement> | null>(null);
  const [activatedElementId, setActivatedElementId] = useState<string | null>(null);
  const [selectedNotepadForFormat, setSelectedNotepadForFormat] = useState<WithId<CanvasElement> | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isEditCommentDialogOpen, setIsEditCommentDialogOpen] = useState(false);
  const [selectedCommentForEdit, setSelectedCommentForEdit] = useState<WithId<CanvasElement> | null>(null);
  
  // Ref para almacenar zIndex original de elementos cuando se editan
  const originalZIndexRef = useRef<Map<string, number>>(new Map());
  
  // Panel de información del elemento (Opción 4: Combinación Panel + Consola)
  const [isInfoPanelVisible, setIsInfoPanelVisible] = useState(false); // Oculto por defecto, se muestra al seleccionar elemento

  // -- DICTADO DE VOZ --
  // Hook de dictado simplificado según Readme 18 Nov
  const {
    isSupported: isDictationSupported,
    isListening: isDictationListening,
    transcript,
    finalTranscript,
    interimTranscript,
    permissionError,
    toggle: toggleDictation,
  } = useDictation();
  
  // liveTranscript combina finalTranscript + interimTranscript para mostrar en tiempo real
  const liveTranscript = useMemo(() => {
    // Combinar texto final acumulado con texto provisional
    const final = finalTranscript || '';
    const interim = interimTranscript || '';
    
    // Si hay texto provisional, agregarlo al final del texto final
    if (interim.trim()) {
      return final + (final ? ' ' : '') + interim;
    }
    
    return final;
  }, [finalTranscript, interimTranscript]);
  
  const handleToggleDictation = useCallback(async () => {
    try {
      await toggleDictation();
    } catch (error) {
      console.error('Error al alternar dictado:', error);
    }
  }, [toggleDictation]);

  // Mostrar error de permisos al usuario
  useEffect(() => {
    if (permissionError) {
      toast({
        variant: 'destructive',
        title: 'Error de Permisos',
        description: permissionError,
        duration: 5000,
      });
    }
  }, [permissionError, toast]);

  // -- GESTIÓN DE ELEMENTOS --
  const getViewportCenter = useCallback(() => {
    if (canvasRef.current) {
      const center = canvasRef.current.getViewportCenter();
      // CRÍTICO: Asegurar que cuando el scroll está en 0,0, los elementos se creen cerca del origen
      // El viewport center debe ser relativo a la posición visible, no absoluta
      return center;
    }
    // Fallback: retornar centro del viewport visible (no absoluto)
    if (typeof window !== 'undefined') {
      return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    }
    return { x: 40000, y: 40000 }; // Fallback para SSR
  }, []);

  // CRÍTICO: Usar ref para elements para evitar recreación de función
  const elementsRef = useRef(elements);
  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

  const getNextZIndex = useCallback(() => {
    const currentElements = elementsRef.current;
    if (!currentElements || currentElements.length === 0) return 1;
    const zIndexes = currentElements
      .filter(e => typeof e.zIndex === 'number')
      .map(e => e.zIndex!);
    return zIndexes.length > 0 ? Math.max(...zIndexes) + 1 : 2;
  }, []); // ✅ Sin dependencias - usa ref

  const { addElement } = useElementManager(boardId, getViewportCenter, getNextZIndex);

  // -- EFECTOS --

  // Sincronizar selección
  // CRÍTICO: Optimizado para evitar re-renders constantes cuando elements cambia
  // Usar useMemo con dependencia correcta del array completo
  const selectedElementId = selectedElementIds.length === 1 ? selectedElementIds[0] : null;
  const foundElement = useMemo(() => {
    if (!selectedElementId || !elements || elements.length === 0) return null;
    return elements.find(el => el.id === selectedElementId) || null;
  }, [selectedElementId, elements]); // ✅ Depender del array completo para evitar datos obsoletos
  
  useEffect(() => {
    setSelectedElement(foundElement);
  }, [foundElement]);

  // -- LOGGING EN CONSOLA cuando se selecciona un elemento --
  // OPTIMIZADO: Solo loggear en desarrollo y con información esencial
  useEffect(() => {
    if (selectedElement) {
      // Mostrar panel automáticamente cuando se selecciona un elemento
      setIsInfoPanelVisible(true);
      
      // Solo loggear en desarrollo y de forma optimizada
      if (process.env.NODE_ENV === 'development') {
        console.log('📋 Elemento seleccionado:', {
          id: selectedElement.id,
          type: selectedElement.type,
          position: {
            x: selectedElement.properties?.position?.x || selectedElement.x || 0,
            y: selectedElement.properties?.position?.y || selectedElement.y || 0,
          },
          size: {
            width: selectedElement.properties?.size?.width || selectedElement.width || 0,
            height: selectedElement.properties?.size?.height || selectedElement.height || 0,
          },
          zIndex: selectedElement.zIndex,
          parentId: selectedElement.parentId,
        });
        // Log completo solo si está habilitado el debug
        if ((window as any).DEBUG_ELEMENTS) {
          console.log('Elemento completo:', selectedElement);
        }
      }
    } else {
      // Ocultar panel cuando no hay elemento seleccionado
      setIsInfoPanelVisible(false);
    }
  }, [selectedElement]);

  // -- ATAJO DE TECLADO: Ctrl+Shift+D para mostrar/ocultar panel --
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setIsInfoPanelVisible(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // CRÍTICO: REFS para prevenir múltiples ejecuciones
  const hasLoadedRef = useRef(false);
  const isLoadingRef = useRef(false);
  const waitTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentBoardIdRef = useRef<string | null>(null);

  // CONSOLIDADO: Un solo useEffect para login y carga de tablero
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    console.log('🔄 [BoardPage] useEffect ejecutado', {
      boardId,
      hasUser: !!user,
      userId: user?.uid,
      isAnonymous: user?.isAnonymous,
      authLoading,
      isLoading: isLoadingRef.current,
      hasLoaded: hasLoadedRef.current,
      currentBoardId: currentBoardIdRef.current
    });
    
    // Resetear flags si cambió boardId
    if (currentBoardIdRef.current !== boardId) {
      console.log('🔄 [BoardPage] BoardId cambió, reseteando flags', {
        old: currentBoardIdRef.current,
        new: boardId
      });
      hasLoadedRef.current = false;
      isLoadingRef.current = false;
      currentBoardIdRef.current = boardId;
    }
    
    // Prevenir múltiples ejecuciones
    if (isLoadingRef.current || authLoading) {
      console.log('⏸️ [BoardPage] Saltando ejecución (ya cargando o auth cargando)', {
        isLoading: isLoadingRef.current,
        authLoading
      });
      return;
    }

    // Limpiar timer anterior
    if (waitTimerRef.current) {
      clearTimeout(waitTimerRef.current);
      waitTimerRef.current = null;
    }

    // Verificar login reciente (solo en cliente)
    const hasRecentLogin = typeof window !== 'undefined' ? sessionStorage.getItem('hasRecentLogin') === 'true' : false;
    const loginTimestamp = typeof window !== 'undefined' ? sessionStorage.getItem('loginTimestamp') : null;
    const redirectingToBoard = typeof window !== 'undefined' ? sessionStorage.getItem('redirectingToBoard') : null;
    const isLoginRecent = hasRecentLogin && loginTimestamp && (Date.now() - parseInt(loginTimestamp)) < 60000;
    
    // Redirigir si no hay usuario y no hay login reciente
    if (!user && !isLoginRecent) {
      if (typeof window !== 'undefined') {
        sessionStorage.clear();
        localStorage.clear();
        window.location.replace('/');
      }
      return;
    }
    
    // Esperar si hay login reciente pero no usuario (CRÍTICO para usuarios anónimos después de redirect)
    if (isLoginRecent && !user) {
      const waitTime = redirectingToBoard === boardId ? 30000 : 10000; // Aumentar tiempo de espera
      console.log('⏳ [BoardPage] Esperando usuario después de login reciente...', {
        waitTime,
        redirectingToBoard,
        boardId,
        hasRecentLogin,
        loginTimestamp
      });
      waitTimerRef.current = setTimeout(() => {
        if (!user && typeof window !== 'undefined') {
          console.log('⚠️ [BoardPage] Timeout: Usuario no disponible después de esperar, redirigiendo...');
          sessionStorage.removeItem('hasRecentLogin');
          sessionStorage.removeItem('loginTimestamp');
          sessionStorage.removeItem('redirectingToBoard');
          window.location.replace('/');
        }
      }, waitTime);
      return;
    }

    // Cargar/crear tablero (SOLO UNA VEZ)
    if (user?.uid && !hasLoadedRef.current && loadBoardRef.current && createBoardRef.current) {
      console.log('✅ [BoardPage] Usuario disponible, cargando/creando tablero', {
        userId: user.uid,
        boardId,
        isAnonymous: user.isAnonymous
      });
      hasLoadedRef.current = true;
      isLoadingRef.current = true;
      const userId = user.uid;
      
      if (boardId === 'new') {
        createBoardRef.current(userId).then((newBoardId: string) => {
          isLoadingRef.current = false;
          if (newBoardId && typeof window !== 'undefined') {
            sessionStorage.setItem('hasRecentLogin', 'true');
            sessionStorage.setItem('loginTimestamp', Date.now().toString());
            window.location.href = `/board/${newBoardId}`;
          } else {
            hasLoadedRef.current = false;
          }
        }).catch((error: any) => {
          isLoadingRef.current = false;
          hasLoadedRef.current = false;
          console.error('❌ Error al crear tablero:', error);
        });
      } else {
        loadBoardRef.current(boardId, userId).then((loadedBoardId: string | null) => {
          isLoadingRef.current = false;
          if (loadedBoardId && typeof window !== 'undefined') {
            setTimeout(() => {
              sessionStorage.removeItem('hasRecentLogin');
              sessionStorage.removeItem('loginTimestamp');
              sessionStorage.removeItem('redirectingToBoard');
            }, 2000);
          } else {
            hasLoadedRef.current = false;
          }
        }).catch((error: any) => {
          isLoadingRef.current = false;
          hasLoadedRef.current = false;
          console.error('❌ Error al cargar tablero:', error);
        });
      }
    }
    
    // Cleanup
    return () => {
      if (waitTimerRef.current) {
        clearTimeout(waitTimerRef.current);
        waitTimerRef.current = null;
      }
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, [boardId, user, authLoading]);

  // -- HANDLERS DE ACCIÓN --

  const handleSelectElement = (elementId: string | null, isMultiSelect: boolean) => {
    if (elementId === null) setSelectedElementIds([]);
    else setSelectedElementIds([elementId]);
  };

  const handleUploadImage = useCallback(async () => {
    if (!user?.uid) {
      toast({ title: 'Error', description: 'Debes iniciar sesión' });
      return;
    }

    const userId = user.uid; // Guardar en variable local
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const uploadResult = await uploadFile(file, userId, storage);
        if (uploadResult.url) {
          await addElement('image', {
            content: { url: uploadResult.url },
            properties: { size: { width: 300, height: 200 } },
          });
          toast({ title: 'Imagen subida' });
        }
      } catch (error) {
        toast({ variant: 'destructive', title: 'Error al subir imagen' });
      }
    };
    input.click();
  }, [user, storage, addElement, toast]);

  const handleFormatToggle = useCallback(() => setIsFormatToolbarOpen(prev => !prev), []);

  // Handler para agregar marcador/localizador desde el menú formato
  const handleAddMarker = useCallback(async () => {
    const viewportCenter = getViewportCenter();
    try {
      await addElement('comment', {
        content: { 
          title: 'Nuevo Localizador', 
          label: 'Localizador',
          text: '' 
        },
        properties: {
          position: viewportCenter,
          size: { width: 48, height: 48 },
        },
      });
      toast({ 
        title: 'Localizador creado', 
        description: 'Se ha marcado una nueva ubicación en el tablero. Edita el nombre para identificarlo.' 
      });
    } catch (error: any) {
      toast({ 
        variant: 'destructive', 
        title: 'Error', 
        description: error.message || 'No se pudo crear el localizador.' 
      });
    }
  }, [getViewportCenter, addElement, toast]);

  const handleLocateElement = useCallback((id: string) => {
    const element = elements.find(el => el.id === id);
    if (element && canvasRef.current) {
      handleSelectElement(id, false);
      canvasRef.current.centerOnElement(element);
    }
  }, [elements]);

  const handleOpenNotepad = useCallback(async (id: string) => {
    const element = elements.find(el => el.id === id);
    if (!element) return;
    updateElement(id, { hidden: false });
    handleSelectElement(id, false);
    if (canvasRef.current) canvasRef.current.centerOnElement(element);
  }, [elements, updateElement]);

  const handleChangeNotepadFormat = useCallback((id: string) => {
    const element = elements.find(el => el.id === id);
    if (element) {
      setSelectedNotepadForFormat(element);
      setChangeFormatDialogOpen(true);
    }
  }, [elements]);

  const handleSaveFormat = useCallback((id: string, format: 'letter' | '10x15') => {
    // FIX: Corregir dimensiones - 10x15 significa 10cm ancho x 15cm alto (no 21 alto x 15 ancho)
    // 10cm = ~378px, 15cm = ~567px (a 96 DPI)
    const newSize = format === 'letter' 
      ? { width: 794, height: 1021 } // Carta: 8.5" x 11"
      : { width: 378, height: 567 }; // 10x15: 10cm ancho x 15cm alto (CORREGIDO)
    updateElement(id, { 
      width: newSize.width,
      height: newSize.height,
      properties: { 
        ...selectedNotepadForFormat?.properties, 
        format, 
        size: newSize 
      } 
    });
    setChangeFormatDialogOpen(false);
  }, [selectedNotepadForFormat, updateElement]);

  const handleEditComment = useCallback((comment: WithId<CanvasElement>) => {
    setSelectedCommentForEdit(comment);
    setIsEditCommentDialogOpen(true);
  }, []);

  // REGLAS Z-INDEX: Cuando se hace click en un elemento, pasa al frente para editarlo
  // Cuadernos y lienzo siempre están en primera capa (zIndex base alto)
  // Después de editar, el elemento vuelve a su posición original
  const handleEditElement = useCallback((elementId: string) => {
    const element = elements.find(el => el.id === elementId);
    if (!element) return;

    // Tipos que siempre deben estar en primera capa (después del tablero)
    const firstLayerTypes = ['notepad', 'notepad-simple', 'test-notepad', 'tabbed-notepad', 'yellow-notepad'];
    const isFirstLayer = firstLayerTypes.includes(element.type);
    
    // Obtener zIndex actual
    const elementProps = typeof element.properties === 'object' && element.properties !== null ? element.properties : {};
    const currentZIndex = elementProps.zIndex ?? element.zIndex ?? 1;
    
    // Guardar zIndex original si no está guardado
    if (!originalZIndexRef.current.has(elementId)) {
      originalZIndexRef.current.set(elementId, currentZIndex);
    }
    
    // Calcular nuevo zIndex: traer al frente temporalmente
    const maxZIndex = getNextZIndex();
    const newZIndex = isFirstLayer 
      ? Math.max(maxZIndex - 100, 1000) // Primera capa: mínimo 1000
      : maxZIndex; // Otros elementos: máximo disponible
    
    // Actualizar zIndex para traer al frente
    updateElement(elementId, {
      properties: {
        ...elementProps,
        zIndex: newZIndex,
      },
    });
    
    // Activar elemento para edición
    setActivatedElementId(elementId);
    
    // Centrar vista en el elemento si está disponible
    if (canvasRef.current) {
      canvasRef.current.centerOnElement(element);
    }
  }, [elements, getNextZIndex, updateElement]);

  // Restaurar zIndex original cuando se deselecciona un elemento
  useEffect(() => {
    if (!activatedElementId && originalZIndexRef.current.size > 0) {
      // Restaurar zIndex original de todos los elementos editados
      originalZIndexRef.current.forEach((originalZIndex, elementId) => {
        const element = elements.find(el => el.id === elementId);
        if (element) {
          const elementProps = typeof element.properties === 'object' && element.properties !== null ? element.properties : {};
          const currentZIndex = elementProps.zIndex ?? element.zIndex ?? 1;
          
          // Solo restaurar si el zIndex actual es diferente al original
          if (currentZIndex !== originalZIndex) {
            updateElement(elementId, {
              properties: {
                ...elementProps,
                zIndex: originalZIndex,
              },
            });
          }
        }
      });
      
      // Limpiar el mapa después de restaurar
      originalZIndexRef.current.clear();
    }
  }, [activatedElementId, elements, updateElement]);

  // Función para exportar el tablero completo a PNG de alta resolución
  const handleExportBoardToPng = useCallback(async () => {
    try {
      if (!canvasRef.current) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'No se pudo acceder al lienzo.',
        });
        return;
      }

      // Obtener el contenedor del canvas
      const canvasContainer = canvasRef.current.getCanvasContainer();
      if (!canvasContainer) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'No se pudo encontrar el contenedor del lienzo.',
        });
        return;
      }

      toast({
        title: 'Exportando...',
        description: 'Generando imagen PNG de alta resolución del tablero completo. Esto puede tardar unos segundos...',
      });

      // Ocultar elementos de UI temporalmente para la exportación
      document.body.classList.add('exporting-to-png');

      // Capturar SOLO el área visible del usuario (viewport) - Usar misma lógica de alta resolución que cuadernos
      const scrollLeft = canvasContainer.scrollLeft;
      const scrollTop = canvasContainer.scrollTop;
      const viewportWidth = canvasContainer.clientWidth;
      const viewportHeight = canvasContainer.clientHeight;
      const scale = 3; // Alta resolución (misma que cuadernos) - captando todos los detalles
      
      // Obtener el rectángulo del contenedor para calcular la posición relativa
      const containerRect = canvasContainer.getBoundingClientRect();
      
      const canvas = await html2canvas(canvasContainer, {
        backgroundColor: '#96e4e6',
        scale: scale,
        useCORS: true,
        logging: false,
        allowTaint: false,
        scrollX: -scrollLeft,
        scrollY: -scrollTop,
        width: viewportWidth,
        height: viewportHeight,
        windowWidth: viewportWidth,
        windowHeight: viewportHeight,
        x: containerRect.left + scrollLeft,
        y: containerRect.top + scrollTop,
      });

      // Restaurar elementos de UI
      document.body.classList.remove('exporting-to-png');

      // Convertir canvas a blob y descargar
      canvas.toBlob((blob: Blob | null) => {
        if (!blob) {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: 'No se pudo generar la imagen.',
          });
          return;
        }

        // Crear URL temporal y descargar
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const boardName = board?.name || 'tablero';
        link.download = `${boardName}_${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        // Mostrar toast de éxito
        toast({
          title: 'Exportado',
          description: 'El tablero se ha exportado como PNG de alta resolución.',
        });
      }, 'image/png', 1.0); // Calidad máxima
    } catch (error: any) {
      document.body.classList.remove('exporting-to-png');
      console.error('Error al exportar tablero:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo exportar el tablero.',
      });
    }
  }, [canvasRef, board, toast]);

  // -- RENDER --
  
  // DEBUG: Log del estado antes de cualquier return
  console.log('🎨 [BoardPage] Render:', {
    boardId,
    hasUser: !!user,
    userId: user?.uid,
    isAnonymous: user?.isAnonymous,
    authLoading,
    isBoardLoading,
    hasBoard: !!board,
    sessionStorage: typeof window !== 'undefined' ? {
      hasRecentLogin: sessionStorage.getItem('hasRecentLogin'),
      loginTimestamp: sessionStorage.getItem('loginTimestamp'),
      redirectingToBoard: sessionStorage.getItem('redirectingToBoard')
    } : 'N/A (SSR)'
  });

  // Mostrar loading mientras auth está cargando
  if (authLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center" style={{ backgroundColor: '#96e4e6' }}>
        <Loader2 className="h-8 w-8 animate-spin text-slate-900" />
        <p className="mt-4 text-lg font-semibold text-slate-900">Verificando autenticación...</p>
      </div>
    );
  }

  // Si no hay usuario después de cargar, verificar login reciente antes de redirigir
  if (!user) {
    // Verificar si hay login reciente (para usuarios anónimos después de redirect)
    if (typeof window !== 'undefined') {
      const hasRecentLogin = sessionStorage.getItem('hasRecentLogin') === 'true';
      const loginTimestamp = sessionStorage.getItem('loginTimestamp');
      const redirectingToBoard = sessionStorage.getItem('redirectingToBoard');
      const isLoginRecent = hasRecentLogin && loginTimestamp && (Date.now() - parseInt(loginTimestamp)) < 60000;
      
      if (isLoginRecent) {
        // Mostrar loading mientras esperamos que Firebase Auth restaure el usuario anónimo
        console.log('⏳ [BoardPage] Render: Login reciente detectado, esperando usuario...', {
          hasRecentLogin,
          loginTimestamp,
          redirectingToBoard,
          boardId
        });
        return (
          <div className="flex h-screen w-full flex-col items-center justify-center" style={{ backgroundColor: '#96e4e6' }}>
            <Loader2 className="h-8 w-8 animate-spin text-slate-900" />
            <p className="mt-4 text-lg font-semibold text-slate-900">Cargando tu tablero...</p>
          </div>
        );
      }
    }
    
    // Si no hay login reciente, redirigir
    console.log('⚠️ [BoardPage] Render: No hay usuario y no hay login reciente, redirigiendo...');
    if (typeof window !== 'undefined') {
      sessionStorage.clear();
      localStorage.clear();
      window.location.replace('/');
    }
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center" style={{ backgroundColor: '#cae3e1' }}>
        <Loader2 className="h-8 w-8 animate-spin text-slate-900" />
        <p className="mt-4 text-lg font-semibold text-slate-900">Redirigiendo...</p>
      </div>
    );
  }

  if (isBoardLoading || boardId === 'new') {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center" style={{ backgroundColor: '#75e8ce' }}>
        <Loader2 className="h-8 w-8 animate-spin text-slate-900" />
        <p className="mt-4 text-lg font-semibold text-slate-900">Cargando tu lienzo...</p>
      </div>
    );
  }

  if (error) return <div className="p-10 text-red-500">Error: {error}</div>;
  
  // Si no hay tablero pero hay usuario, mostrar loading mientras se carga
  if (!board && user) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center" style={{ backgroundColor: '#cae3e1' }}>
        <Loader2 className="h-8 w-8 animate-spin text-slate-900" />
        <p className="mt-4 text-lg font-semibold text-slate-900">Cargando tu tablero...</p>
      </div>
    );
  }
  
  // Si no hay tablero y no hay usuario, ya se manejó arriba
  if (!board) return null;

  return (
    <>
      <RenameBoardDialog
        isOpen={isRenameBoardDialogOpen}
        onOpenChange={setIsRenameBoardDialogOpen}
        currentBoardName={board?.name || 'Sin nombre'}
        onSave={handleSaveRenameBoard}
      />
      <div className="h-screen w-screen relative bg-[#3b3b3b] overflow-hidden">
      
      {/* 1. LIENZO INFINITO */}
      <Canvas
        ref={canvasRef}
        elements={elements as WithId<CanvasElement>[]}
        board={board as WithId<Board>}
        selectedElementIds={selectedElementIds}
        onSelectElement={handleSelectElement}
        updateElement={updateElement}
        deleteElement={deleteElement}
        unanchorElement={(id) => {
          const element = elements.find(el => el.id === id);
          if (element && element.parentId) {
            updateElement(id, { parentId: undefined });
          }
        }}
        addElement={addElement}
        
        // Interacciones
        onLocateElement={handleLocateElement}
        onFormatToggle={handleFormatToggle}
        onChangeNotepadFormat={handleChangeNotepadFormat}
        onEditElement={handleEditElement}
        
        // Estado
        selectedElement={selectedElement}
        activatedElementId={activatedElementId}
        isMobile={isMobile}
        setIsDirty={setIsDirty}
        isListening={isDictationListening}
        liveTranscript={liveTranscript}
        finalTranscript={finalTranscript}
        interimTranscript={interimTranscript}
        
        // Placeholders para props requeridas por Canvas antiguo
        onBringToFront={() => {}}
        onSendToBack={() => {}}
        onMoveBackward={() => {}}
        onGoToHome={() => canvasRef.current?.goToHome()}
        onCenterView={() => {}}
        onGroupElements={() => {}}
        saveLastView={() => {}}
        onActivateDrag={() => {}}
        onEditComment={handleEditComment}
        onDuplicateElement={() => {}}
        onUngroup={() => {}}
      />
      
      {/* 2. MENÚ PRINCIPAL (Mapeo de funciones al nuevo ToolsSidebar "Blindado") */}
      <ToolsSidebar
        elements={elements || []}
        boards={boards || []}
        onUploadImage={handleUploadImage}
        onAddImageFromUrl={() => setIsImageUrlDialogOpen(true)}
        onPanToggle={() => canvasRef.current?.activatePanMode()}
        onRenameBoard={handleRenameBoardWrapper}
        onDeleteBoard={handleDeleteBoard}
        isListening={isDictationListening}
        onToggleDictation={handleToggleDictation}
        onOpenNotepad={handleOpenNotepad}
        onLocateElement={handleLocateElement}
        addElement={addElement}
        clearCanvas={clearCanvasWrapper}
        onExportBoardToPng={handleExportBoardToPng}
        onFormatToggle={handleFormatToggle}
        isFormatToolbarOpen={isFormatToolbarOpen}
      />

      {/* 3. BARRA DE FORMATO */}
      <FormattingToolbar
        isOpen={isFormatToolbarOpen}
        onClose={() => setIsFormatToolbarOpen(false)}
        elements={selectedElement ? [selectedElement] : []}
        onAddComment={handleAddMarker}
        onEditComment={handleEditComment}
        isMobileSheet={isMobile}
        onLocateElement={handleLocateElement}
        onPanToggle={() => {
          setIsPanningActive(prev => !prev);
          canvasRef.current?.activatePanMode();
        }}
        addElement={addElement}
        isPanningActive={isPanningActive}
      />

      {/* 4. DIÁLOGOS */}
      <ChangeFormatDialog
        isOpen={changeFormatDialogOpen}
        onOpenChange={setChangeFormatDialogOpen}
        notepad={selectedNotepadForFormat}
        onSaveFormat={handleSaveFormat}
      />

      <AddImageFromUrlDialog
        isOpen={isImageUrlDialogOpen}
        onOpenChange={setIsImageUrlDialogOpen}
        onAddImage={async (url) => {
          await addElement('image', { content: { url }, properties: { size: { width: 300, height: 200 } } });
          setIsImageUrlDialogOpen(false);
        }}
      />


      {/* Diálogo de edición de comentarios */}
      {selectedCommentForEdit && (
        <EditCommentDialog
          isOpen={isEditCommentDialogOpen}
          onOpenChange={setIsEditCommentDialogOpen}
          comment={selectedCommentForEdit}
          onUpdate={updateElement}
          onDelete={deleteElement}
        />
      )}

      {/* Panel de información del elemento (Opción 4) */}
      <ElementInfoPanel
        element={selectedElement}
        isVisible={isInfoPanelVisible && !!selectedElement}
        onClose={() => setIsInfoPanelVisible(false)}
      />
      </div>
    </>
  );
}