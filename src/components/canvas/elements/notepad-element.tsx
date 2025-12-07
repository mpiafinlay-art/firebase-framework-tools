'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Card, CardFooter, CardContent } from '@/components/ui/card';
import type { CommonElementProps, NotepadContent, CanvasElementProperties } from '@/lib/types';
import {
  MoreVertical, X, Minus, Maximize, GripVertical,
  FileImage, Settings,
  ChevronLeft, ChevronRight, Plus, Save,
  Info, Eraser, CalendarDays, Wrench, FileSignature, Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import DeleteNotepadDialog from './delete-notepad-dialog';
import { useAutoSave } from '@/hooks/use-auto-save';
import { SaveStatusIndicator } from '@/components/canvas/save-status-indicator';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import ExportPdfDialog from './export-pdf-dialog';
import './notepad-element.css';
import { useDictationInput } from '@/hooks/use-dictation-input';

const PaginationControls = ({
  currentPage,
  totalPages,
  onPageChange,
  onAddPage,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onAddPage: () => void;
}) => {
  return (
    <div className="flex items-center justify-center gap-1">
      <Button
        variant="outline"
        size="icon"
        className="h-7 w-7"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 0}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm font-medium text-muted-foreground">
        {currentPage + 1} / {totalPages}
      </span>
      <Button
        variant="outline"
        size="icon"
        className="h-7 w-7"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages - 1}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="h-7 w-7"
        onClick={onAddPage}
        disabled={totalPages >= 20}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default function NotepadElement(props: CommonElementProps) {
  const { 
    id,
    content,
    properties,
    onUpdate,
    deleteElement,
    isPreview = false, 
    onFormatToggle, 
    isListening,
    liveTranscript,
    finalTranscript,
    interimTranscript,
    isSelected,
    minimized,
    onChangeNotepadFormat,
    onEditElement,
  } = props;
  
  const typedContent = (content || {}) as NotepadContent;
  const titleRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  
  const [isExportingPng, setIsExportingPng] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportPdfDialogOpen, setIsExportPdfDialogOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  const currentPageIndex = typedContent.currentPage ?? 0;
  
  // Refs para mantener referencias estables y evitar loops
  const typedContentRef = useRef(typedContent);
  const currentPageIndexRef = useRef(currentPageIndex);
  
  // Sincronizar refs cuando cambian
  useEffect(() => {
    typedContentRef.current = typedContent;
    currentPageIndexRef.current = currentPageIndex;
  }, [typedContent, currentPageIndex]);
  
  // Hook de autoguardado robusto para el contenido del cuaderno
  // IMPORTANTE: Se actualiza cuando cambia currentPageIndex para evitar stale closures
  const { saveStatus, handleBlur: handleAutoSaveBlur, handleChange, forceSave } = useAutoSave({
    getContent: () => {
      if (isPreview || !contentRef.current) return '';
      const html = contentRef.current.innerHTML;
      // Normalizar HTML para comparación consistente
      return html.replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim();
    },
    onSave: async (newHtml) => {
      if (isPreview || !contentRef.current) return;
      // Usar refs para evitar dependencias circulares
      const currentContent = typedContentRef.current;
      const currentPage = currentPageIndexRef.current;
      const currentPages = currentContent.pages || [''];
      const currentPageContent = (currentPages[currentPage] || '').replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim();
      // Comparar contenido normalizado
      if (newHtml !== currentPageContent) {
        const newPages = [...currentPages];
        newPages[currentPage] = newHtml;
        await onUpdate(id, { content: { ...currentContent, pages: newPages } });
      }
    },
    debounceMs: 2000,
    disabled: isPreview,
    compareContent: (oldContent, newContent) => {
      // Usar refs para evitar dependencias circulares
      const currentContent = typedContentRef.current;
      const currentPage = currentPageIndexRef.current;
      const currentPages = currentContent.pages || [''];
      const currentPageContent = (currentPages[currentPage] || '').replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim();
      // Normalizar ambos para comparación
      const normalizedOld = (oldContent || '').replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim();
      const normalizedNew = (newContent || '').replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim();
      return normalizedOld === normalizedNew && normalizedOld === currentPageContent;
    },
  });

  // Función de guardado manual (para compatibilidad con código existente)
  const saveContent = useCallback(async () => {
    if (isPreview || !contentRef.current) return;
    
    // CRÍTICO: Guardar el HTML actual directamente ANTES de llamar a forceSave
    const currentHtml = contentRef.current.innerHTML;
    const currentContent = typedContentRef.current;
    const currentPage = currentPageIndexRef.current;
    const currentPages = currentContent.pages || [''];
    
    // Actualizar la página actual con el contenido HTML actual
    const newPages = [...currentPages];
    newPages[currentPage] = currentHtml;
    
    // Guardar directamente en Firestore (esto es seguro, solo actualiza el contenido)
    await onUpdate(id, { 
      content: { ...currentContent, pages: newPages }
    });
    
    // También ejecutar forceSave para mantener sincronización del hook
    await forceSave();
  }, [forceSave, isPreview, contentRef, typedContentRef, currentPageIndexRef, onUpdate, id]);

  // Ref para almacenar el contenido anterior y evitar loops
  const prevPagesRef = useRef<string>('');
  
  useEffect(() => {
    if (contentRef.current) {
      // Crear string estable para comparar
      const pagesString = JSON.stringify(typedContent.pages) + currentPageIndex;
      
      // Solo ejecutar si realmente cambió
      if (prevPagesRef.current === pagesString) {
        return;
      }
      
      prevPagesRef.current = pagesString;
      
      const isFocused = document.activeElement === contentRef.current;
      if (!isFocused) {
        const pageContent = typedContent.pages?.[currentPageIndex] ?? '';
        // Limpiar contenido vacío o con solo <div><br></div>
        const cleanContent = pageContent === '<div><br></div>' || pageContent === '<div></div>' || pageContent.trim() === '' ? '' : pageContent;
        // CRÍTICO: Solo actualizar si NO está enfocado (preservar cursor)
        if (!isFocused && contentRef.current.innerHTML !== cleanContent) {
          // Usar helper para preservar cursor si hay uno guardado
          const { updateInnerHTMLPreservingCursor } = require('@/lib/cursor-helper');
          updateInnerHTMLPreservingCursor(contentRef.current, cleanContent);
        }
      }
    }
  }, [typedContent.pages, currentPageIndex]);

  // Soporte para dictado usando hook helper
  useDictationInput({
    elementRef: contentRef as React.RefObject<HTMLElement | HTMLInputElement | HTMLTextAreaElement>,
    isListening: isListening || false,
    liveTranscript: liveTranscript || '',
    finalTranscript: finalTranscript || '',
    interimTranscript: interimTranscript || '',
    isSelected: isSelected || false,
    enabled: true,
  });
  
  const handleTitleFocus = useCallback(() => {
    if (isPreview) return;
    onEditElement(id);
  }, [isPreview, onEditElement, id]);

  // Hook de autoguardado para el título
  const { handleBlur: handleTitleBlurAutoSave } = useAutoSave({
    getContent: () => titleRef.current?.innerText || '',
    onSave: async (newTitle) => {
      if (isPreview || !titleRef.current) return;
      // Usar ref para evitar dependencias circulares
      const currentContent = typedContentRef.current;
      if (currentContent.title !== newTitle) {
        const newContent: NotepadContent = { ...currentContent, title: newTitle };
        onUpdate(id, { content: newContent });
      }
    },
    debounceMs: 1000, // Título se guarda más rápido
    disabled: isPreview,
  });

  const handleTitleBlur = useCallback(async () => {
    if (isPreview || !titleRef.current) return;
    await handleTitleBlurAutoSave();
  }, [isPreview, handleTitleBlurAutoSave]);
  
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text/plain');
    if (pastedText) {
        document.execCommand('insertText', false, pastedText);
    }
  }, []);
  
  const handlePageChange = useCallback((newPage: number) => {
    if (isPreview) return;
    // Usar ref para evitar dependencias circulares
    const currentContent = typedContentRef.current;
    if (newPage >= 0 && newPage < (currentContent.pages?.length || 0)) {
      saveContent(); 
      onUpdate(id, {
        content: { ...currentContent, currentPage: newPage }
      });
    }
  }, [isPreview, onUpdate, id, saveContent]);

  const handleAddPage = useCallback(() => {
    if (isPreview) return;
    // Usar ref para evitar dependencias circulares
    const currentContent = typedContentRef.current;
    if ((currentContent.pages?.length || 0) < 20) {
      saveContent();
      const newPages = [...(currentContent.pages || []), '']; // Página vacía sin <div><br></div>
      onUpdate(id, {
        content: { ...currentContent, pages: newPages, currentPage: newPages.length - 1 },
      });
    }
  }, [isPreview, onUpdate, id, saveContent]);

  const toggleMinimize = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isPreview) return;
    
    // CRÍTICO: Guardar contenido ANTES de minimizar y ESPERAR
    await saveContent();
    
    // Esperar un momento adicional para asegurar que Firestore recibió el update
    await new Promise(resolve => setTimeout(resolve, 150));
    
    const isMinimized = !!minimized;
    const currentSize = (properties as CanvasElementProperties)?.size || { width: 794, height: 1021 };
    
    const currentSizeNumeric = {
      width: typeof currentSize.width === 'number' ? currentSize.width : parseFloat(String(currentSize.width)) || 794,
      height: typeof currentSize.height === 'number' ? currentSize.height : parseFloat(String(currentSize.height)) || 1021,
    };

    if (isMinimized) {
      const { originalSize, ...restProps } = (properties || {}) as Partial<CanvasElementProperties>;
      const restoredSize = originalSize || { width: 794, height: 1021 };
      const newProperties: Partial<CanvasElementProperties> = { 
        ...restProps, 
        size: restoredSize 
      };
      
      onUpdate(id, {
        minimized: false,
        properties: newProperties,
        // CRÍTICO: No tocar el contenido al restaurar
      });
    } else {
      const currentWidth = typeof currentSize.width === 'number' ? currentSize.width : parseFloat(String(currentSize.width)) || 794;
      onUpdate(id, {
        minimized: true,
        properties: { 
          ...properties, 
          size: { width: currentWidth, height: 48 }, 
          originalSize: currentSizeNumeric 
        },
        // CRÍTICO: No tocar el contenido al minimizar
      });
    }
  }, [isPreview, minimized, properties, onUpdate, id, saveContent]);
  
  const handleCloseNotepad = useCallback((e: React.MouseEvent) => { 
    e.stopPropagation(); 
    e.preventDefault();
    if (isPreview) return; 
    saveContent();
    onUpdate(id, { hidden: true }); 
  }, [isPreview, saveContent, onUpdate, id]);

  const handleExportNotepadToPng = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isPreview) return;

    try {
      // Buscar el elemento Card del notepad
      const notepadCard = document.querySelector(`[data-element-id="${id}"]`) as HTMLElement;
      if (!notepadCard) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'No se pudo encontrar el elemento para exportar.',
        });
        return;
      }

      setIsExportingPng(true);
      toast({
        title: 'Exportando...',
        description: 'Generando imagen PNG de alta resolución del cuaderno.',
      });

      // Capturar el elemento usando html2canvas con alta resolución (reducido 30%)
      const canvas = await html2canvas(notepadCard, {
        backgroundColor: '#ffffff',
        scale: 2.1, // Alta resolución reducida 30% (de 3x a 2.1x)
        useCORS: true,
        logging: false,
        allowTaint: false,
        windowWidth: notepadCard.scrollWidth,
        windowHeight: notepadCard.scrollHeight,
      });

      // Convertir canvas a blob y descargar
      canvas.toBlob((blob: Blob | null) => {
        if (!blob) {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: 'No se pudo generar la imagen.',
          });
          setIsExportingPng(false);
          return;
        }

        // Crear URL temporal y descargar
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const notepadTitle = typedContent.title || 'cuaderno';
        link.download = `${notepadTitle}_${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        // Mostrar toast de éxito
        toast({
          title: 'Exportado',
          description: 'El cuaderno se ha exportado como PNG de alta resolución.',
        });
        setIsExportingPng(false);
      }, 'image/png', 1.0); // Calidad máxima
    } catch (error: any) {
      console.error('Error al exportar cuaderno:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo exportar el cuaderno.',
      });
      setIsExportingPng(false);
    }
  }, [toast, id, isPreview, typedContent.title]);

  const handleExportNotepadToPdf = useCallback(async (selectedPages: number[]) => {
    if (isPreview) return;

    try {
      setIsExportingPdf(true);
      toast({
        title: 'Exportando...',
        description: `Generando PDF con ${selectedPages.length} página${selectedPages.length > 1 ? 's' : ''}.`,
      });

      // Buscar el elemento Card del notepad
      const notepadCard = document.querySelector(`[data-element-id="${id}"]`) as HTMLElement;
      if (!notepadCard) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'No se pudo encontrar el elemento para exportar.',
        });
        setIsExportingPdf(false);
        return;
      }

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [794, 1021], // Tamaño carta en píxeles
      });

      // Guardar la página actual
      const savedCurrentPage = typedContent.currentPage || 0;

      // Exportar cada página seleccionada
      for (let i = 0; i < selectedPages.length; i++) {
        const pageIndex = selectedPages[i];
        
        // Cambiar a la página que queremos exportar
        if (onUpdate && pageIndex !== savedCurrentPage) {
          onUpdate(id, { content: { ...typedContent, currentPage: pageIndex } });
          // Esperar un momento para que se renderice
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Capturar la página actual
        const canvas = await html2canvas(notepadCard, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true,
          logging: false,
          allowTaint: false,
          windowWidth: notepadCard.scrollWidth,
          windowHeight: notepadCard.scrollHeight,
        });

        const imgData = canvas.toDataURL('image/png');

        // Agregar página al PDF (excepto la primera)
        if (i > 0) {
          pdf.addPage();
        }

        // Calcular dimensiones manteniendo aspecto
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
        const finalWidth = imgWidth * ratio;
        const finalHeight = imgHeight * ratio;
        const x = (pdfWidth - finalWidth) / 2;
        const y = (pdfHeight - finalHeight) / 2;

        pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);
      }

      // Restaurar la página original
      if (onUpdate && savedCurrentPage !== typedContent.currentPage) {
        onUpdate(id, { content: { ...typedContent, currentPage: savedCurrentPage } });
      }

      // Descargar PDF
      const notepadTitle = typedContent.title || 'cuaderno';
      pdf.save(`${notepadTitle}_${Date.now()}.pdf`);

      toast({
        title: 'Exportado',
        description: `PDF exportado con ${selectedPages.length} página${selectedPages.length > 1 ? 's' : ''}.`,
      });
      setIsExportingPdf(false);
    } catch (error: any) {
      console.error('Error al exportar cuaderno a PDF:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo exportar el cuaderno a PDF.',
      });
      setIsExportingPdf(false);
    }
  }, [toast, id, isPreview, typedContent, onUpdate]);

  useEffect(() => {
    const titleEl = titleRef.current;
    if (titleEl && titleEl.innerText !== (typedContent.title || '')) {
      titleEl.innerText = typedContent.title || '';
    }
  }, [typedContent.title]);

  const execCommand = useCallback((e: React.MouseEvent, command: string, value?: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (contentRef.current) {
      contentRef.current.focus();
      document.execCommand(command, false, value ?? undefined);
    }
  }, []);

  const handleRemoveFormat = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isPreview || !contentRef.current) return;
    
    const selection = window.getSelection();
    // CRÍTICO: Solo ejecutar si hay selección válida
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return; // No hacer nada si no hay selección
    }
    
    try {
      execCommand(e, 'removeFormat');
      // Disparar evento input para activar autoguardado
      contentRef.current.dispatchEvent(new Event('input', { bubbles: true }));
    } catch (error) {
      console.error('Error al limpiar formato:', error);
    }
  }, [execCommand, isPreview, contentRef]);
  const handleInsertDate = useCallback((e: React.MouseEvent) => execCommand(e, 'insertHTML', `<span style="color: #a0a1a6;">-- ${format(new Date(), 'dd/MM/yy')} </span>`), [execCommand]);
  
  const handleSelectAllText = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (contentRef.current) {
      contentRef.current.focus();
      const range = document.createRange();
      range.selectNodeContents(contentRef.current);
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  }, []);

  const handleDeleteConfirmed = useCallback(() => {
    deleteElement(id);
    setIsDeleteDialogOpen(false);
  }, [deleteElement, id]);

  const safeProperties = (typeof properties === 'object' && properties !== null) ? properties : {};
  const formatType = (safeProperties as CanvasElementProperties)?.format || 'letter';
  const isSmallFormat = formatType === '10x15';

  if (minimized) {
      return (
          <Card className="notepad-card w-full h-full flex items-center shadow-lg rounded-lg bg-card border-2 border-primary/50 group" data-element-id={id}>
               <div className="p-2 flex flex-row items-center gap-1 w-full cursor-grab active:cursor-grabbing drag-handle">
                  <div className="p-1"><GripVertical className="size-5 text-muted-foreground" /></div>
                  <p className="font-headline text-sm font-semibold truncate flex-grow">{typedContent.title || 'Sin título'}</p>
                  <Button variant="ghost" size="icon" className="size-7" title="Maximizar" onMouseDown={(e) => {e.preventDefault(); e.stopPropagation(); toggleMinimize(e)}}>
                      <Maximize className="size-4" />
                  </Button>
              </div>
          </Card>
      )
  }

  // Color de fondo: #f8f0ad para elementos específicos, blanco para otros
  // NOTA: aJRVj1bVggtfgGFe5NNz NO debe estar en la lista especial (restaurado a estado funcional normal)
  const isSpecialNotepad = id === 'oyDN2LIr8z7VyYA5727F' || id === 'FdQ656GJ94TePuHpotbY' || id === 'Iz0UWQ5gQwXlkX1kGBf1' || id === 'kRfKpBDg946Y99668Tih';
  const notepadBackgroundColor = isSpecialNotepad ? '#f8f0ad' : '#ffffff';
  
  // REGLA ESPECIAL: Cuadernos - Al hacer click suben a primera capa para editar, luego vuelven atrás
  const handleNotepadClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.drag-handle')) {
      return; // No hacer nada si se hace click en el drag handle
    }
    const currentZIndex = safeProperties?.zIndex || 1;
    // Subir a primera capa temporalmente (zIndex alto)
    onUpdate(id, { properties: { ...safeProperties, zIndex: 9999 } });
    // Volver a zIndex original después de un tiempo
    setTimeout(() => {
      if (!isSelected) { // Solo volver si no está seleccionado
        onUpdate(id, { properties: { ...safeProperties, zIndex: currentZIndex } });
      }
    }, 2000);
  }, [id, safeProperties, onUpdate, isSelected]);

  return (
    <Card 
      data-element-id={id} 
      className="notepad-card w-full h-full flex flex-col shadow-lg rounded-lg group"
      style={{ backgroundColor: notepadBackgroundColor }}
      onClick={handleNotepadClick}
    >
        <div className="p-2 border-b flex flex-row items-center gap-1 cursor-grab active:cursor-grabbing drag-handle">
            <div className="p-1"><GripVertical className="size-5 text-muted-foreground" /></div>
            <div
                ref={titleRef}
                contentEditable={!isPreview}
                spellCheck="true"
                suppressContentEditableWarning
                onFocus={handleTitleFocus}
                onBlur={handleTitleBlur}
                className="bg-transparent flex-grow outline-none cursor-text font-headline text-sm font-semibold p-1"
                data-placeholder='Título'
                onMouseDown={(e) => e.stopPropagation()}
            />
            {!isPreview && (
                <div onMouseDown={(e) => e.stopPropagation()} className="flex items-center">
                    <Button variant="ghost" size="icon" className="size-7" title="Guardar" onClick={saveContent}><Save className="size-4"/></Button>
                    <Button variant="ghost" size="icon" className="size-7" title="Info" onClick={() => setIsInfoOpen(!isInfoOpen)}><Info className="size-4"/></Button>
                    <Button variant="ghost" size="icon" className="size-7" title="Seleccionar Todo" onClick={handleSelectAllText}><FileSignature className="size-4"/></Button>
                    <Button variant="ghost" size="icon" className="size-7" title="Limpiar Formato" onClick={handleRemoveFormat}><Eraser className="size-4"/></Button>
                    {onFormatToggle && (
                      <Button variant="ghost" size="icon" className="size-7" title="Herramientas de Formato" onClick={onFormatToggle}><Wrench className="size-4"/></Button>
                    )}
                    <Button variant="ghost" size="icon" className="size-7" title="Insertar Fecha" onClick={handleInsertDate}><CalendarDays className="size-4"/></Button>
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-7"><MoreVertical className="size-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent>
                          <DropdownMenuItem onMouseDown={(e) => {e.preventDefault(); e.stopPropagation(); handleExportNotepadToPng(e)}} disabled={isExportingPng}>
                              <FileImage className="mr-2 h-4 w-4" />
                              <span>{isExportingPng ? 'Exportando...' : 'Exportar a PNG: alta resolución'}</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onMouseDown={(e) => {
                              e.preventDefault(); 
                              e.stopPropagation(); 
                              setIsExportPdfDialogOpen(true);
                            }} 
                            disabled={isExportingPdf}
                          >
                              <FileImage className="mr-2 h-4 w-4" />
                              <span>{isExportingPdf ? 'Exportando PDF...' : 'Exportar páginas a PDF'}</span>
                          </DropdownMenuItem>
                          {onChangeNotepadFormat && (
                            <DropdownMenuItem onMouseDown={(e) => {e.preventDefault(); e.stopPropagation(); onChangeNotepadFormat(id)}}>
                                <Settings className="mr-2 h-4 w-4" /><span>Cambiar formato...</span>
                            </DropdownMenuItem>
                          )}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Button variant="ghost" size="icon" className="size-7" title={minimized ? "Maximizar" : "Minimizar"} onMouseDown={(e) => {e.preventDefault(); e.stopPropagation(); toggleMinimize(e)}}>{minimized ? <Maximize className="size-4" /> : <Minus className="size-4" />}</Button>
                    
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="size-7 text-destructive hover:text-destructive" 
                        title="Eliminar Cuaderno" 
                        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsDeleteDialogOpen(true); }}
                    >
                        <Trash2 className="size-4" />
                    </Button>

                    <Button variant="ghost" size="icon" className="size-7" title="Cerrar" onMouseDown={handleCloseNotepad}><X className="size-4" /></Button>
                </div>
            )}
        </div>
        {!minimized && (
            <>
                <CardContent 
                  className={cn(
                    "p-0 flex-grow relative font-body",
                    id === 'kRfKpBDg946Y99668Tih' ? "overflow-y-auto" : "overflow-y-auto" // Scroll infinito para kRfKpBDg946Y99668Tih
                  )}
                  style={{ backgroundColor: id === 'rzBhqCTd8wwZmD8JCNEk' ? '#fafad7' : notepadBackgroundColor }} // Color de fondo especial para rzBhqCTd8wwZmD8JCNEk
                >
                    {/* Sistema de líneas y margen rojo del super cuaderno */}
                    <div className={cn("notepad-content-container", isSmallFormat && "small-format", (id === 'oyDN2LIr8z7VyYA5727F' || id === 'FdQ656GJ94TePuHpotbY' || id === 'Iz0UWQ5gQwXlk1kGBf1' || id === 'kRfKpBDg946Y99668Tih' || id === 'EktERYKT8kyk3JWymwbu' || id === 'rzBhqCTd8wwZmD8JCNEk') && "small-typography")} data-element-id={id}>
                        {/* Fondo con líneas horizontales perfectas y margen rojo */}
                        <div className={cn("notepad-lines-background", isSmallFormat && "small-format", (id === 'oyDN2LIr8z7VyYA5727F' || id === 'FdQ656GJ94TePuHpotbY' || id === 'Iz0UWQ5gQwXlk1kGBf1' || id === 'kRfKpBDg946Y99668Tih' || id === 'EktERYKT8kyk3JWymwbu' || id === 'rzBhqCTd8wwZmD8JCNEk') && "small-typography")} data-element-id={id} />
                    {!isPreview && (
                       <div 
                          className="absolute w-1 h-1 bg-red-500 rounded-full"
                          style={{ 
                            left: isSmallFormat ? '18px' : '38px',
                            top: isSmallFormat ? 'calc(100% - 30px)' : 'calc(100% - 48px)'
                          }}
                          title="Indicador de fin de página visible"
                       />
                    )}
                    {isInfoOpen && (
                      <div className='absolute inset-0 bg-white/95 z-20 p-4 text-xs overflow-y-auto' onClick={() => setIsInfoOpen(false)}>
                        <h3 className='font-bold mb-2 text-base'>Comandos de Dictado por Voz</h3>
                        <p>WIP</p>
                        <p className="text-center mt-4 text-gray-500">Haz clic en cualquier lugar para cerrar</p>
                      </div>
                    )}
                        {/* Área de contenido editable con alineación perfecta */}
                        <div
                            ref={contentRef}
                            contentEditable={!isPreview}
                            spellCheck="true"
                            suppressContentEditableWarning
                            onPaste={handlePaste}
                            onFocus={() => onEditElement(id)}
                            onInput={handleChange}
                            onBlur={handleAutoSaveBlur}
                            className={cn(
                                "notepad-content-editable",
                                isSmallFormat && "small-format",
                                (id === 'oyDN2LIr8z7VyYA5727F' || id === 'FdQ656GJ94TePuHpotbY' || id === 'Iz0UWQ5gQwXlk1kGBf1' || id === 'kRfKpBDg946Y99668Tih' || id === 'EktERYKT8kyk3JWymwbu' || id === 'rzBhqCTd8wwZmD8JCNEk') && "small-typography",
                                id === 'kRfKpBDg946Y99668Tih' && "infinite-scroll", // Scroll infinito para kRfKpBDg946Y99668Tih
                                !isSmallFormat && "p-[32px_24px_16px_0px]", // Padding ajustado: sin padding-left porque el CSS lo maneja
                                isSmallFormat && "p-[16px_12px_8px_0px]" // Padding ajustado para formato pequeño
                            )}
                            data-element-id={id}
                        />
                        
                        {/* Indicador de estado de guardado */}
                        {!isPreview && (
                            <div className="absolute top-2 right-2 z-20">
                                <SaveStatusIndicator status={saveStatus} size="sm" />
                            </div>
                        )}
                    </div>
                </CardContent>
                {!isPreview && (
                    <CardFooter className="p-2 border-t justify-center" onMouseDown={(e) => e.stopPropagation()}>
                       <PaginationControls
                          currentPage={currentPageIndex}
                          totalPages={typedContent.pages?.length || 1}
                          onPageChange={handlePageChange}
                          onAddPage={handleAddPage}
                       />
                    </CardFooter>
                )}
            </>
        )}
        <DeleteNotepadDialog
            isOpen={isDeleteDialogOpen}
            onOpenChange={setIsDeleteDialogOpen}
            onConfirm={handleDeleteConfirmed}
        />
        <ExportPdfDialog
          isOpen={isExportPdfDialogOpen}
          onOpenChange={setIsExportPdfDialogOpen}
          totalPages={typedContent.pages?.length || 1}
          onExport={handleExportNotepadToPdf}
        />
    </Card>
  );
}
