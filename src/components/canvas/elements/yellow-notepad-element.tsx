'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import type { CommonElementProps, YellowNotepadContent } from '@/lib/types';
import {
  Grid3x3,
  Search,
  Calendar,
  Trash2,
  X,
  FileImage,
  MoreVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAutoSave } from '@/hooks/use-auto-save';
import { SaveStatusIndicator } from '@/components/canvas/save-status-indicator';
import { useDictationInput } from '@/hooks/use-dictation-input';
import { cn } from '@/lib/utils';
import html2canvas from 'html2canvas';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function YellowNotepadElement(props: CommonElementProps) {
  const {
    id,
    content,
    properties,
    onUpdate,
    deleteElement,
    isSelected,
    isListening,
    liveTranscript,
    finalTranscript,
    interimTranscript,
  } = props;

  const { toast } = useToast();
  const contentRef = useRef<HTMLDivElement>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExportingPng, setIsExportingPng] = useState(false);

  // Parsear contenido
  const typedContent = (content || {}) as YellowNotepadContent;
  const textContent = typedContent.text || '';
  const initialSearchQuery = typedContent.searchQuery || '';
  
  // Refs para mantener referencias estables y evitar loops
  const typedContentRef = useRef(typedContent);
  const textContentRef = useRef(textContent);
  
  // Sincronizar refs cuando cambian
  useEffect(() => {
    typedContentRef.current = typedContent;
    textContentRef.current = textContent;
  }, [typedContent, textContent]);
  
  // Estado local para búsqueda (sincronizado con contenido)
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  
  // Ref para almacenar el searchQuery anterior y evitar loops
  const prevSearchQueryRef = useRef<string | undefined>(undefined);
  
  // Sincronizar searchQuery cuando cambia el contenido
  useEffect(() => {
    const currentSearchQuery = typedContent.searchQuery;
    // Solo actualizar si realmente cambió
    if (currentSearchQuery !== undefined && currentSearchQuery !== prevSearchQueryRef.current) {
      prevSearchQueryRef.current = currentSearchQuery;
      if (currentSearchQuery !== searchQuery) {
        setSearchQuery(currentSearchQuery);
      }
    }
  }, [typedContent.searchQuery, searchQuery]);

  // Hook de autoguardado
  const { saveStatus, handleBlur: handleAutoSaveBlur, handleChange } = useAutoSave({
    getContent: () => {
      const html = contentRef.current?.innerText || '';
      return html;
    },
    onSave: async (newText) => {
      // Usar refs para evitar dependencias circulares
      const currentText = textContentRef.current;
      const normalizedText = (currentText || '').trim();
      if (newText !== normalizedText) {
        await onUpdate(id, { 
          content: { 
            text: newText,
            searchQuery: searchQuery 
          } 
        });
      }
    },
    debounceMs: 2000,
    compareContent: (oldContent, newContent) => {
      const normalizedOld = (oldContent || '').trim();
      const normalizedNew = (newContent || '').trim();
      return normalizedOld === normalizedNew;
    },
  });

  // Ref para almacenar el textContent anterior y evitar loops
  const prevTextContentRef = useRef<string>('');
  
  // Sincronizar contenido desde props
  useEffect(() => {
    // Solo ejecutar si realmente cambió
    if (prevTextContentRef.current === textContent) {
      return;
    }
    prevTextContentRef.current = textContent;
    
    if (contentRef.current && textContent !== contentRef.current.innerText) {
      const isFocused = document.activeElement === contentRef.current;
      if (!isFocused) {
        contentRef.current.innerText = textContent || '';
      }
    }
  }, [textContent]);

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

  // Exportar a PNG
  const handleExportToPng = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    try {
      const yellowNotepadCard = document.querySelector(`[data-element-id="${id}"]`) as HTMLElement;
      if (!yellowNotepadCard) {
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
        description: 'Generando imagen PNG de alta resolución.',
      });

      const canvas = await html2canvas(yellowNotepadCard, {
        backgroundColor: '#FFFFE0',
        scale: 2.1, // Alta resolución reducida 30% (de 3x a 2.1x)
        useCORS: true,
        logging: false,
        allowTaint: false,
        windowWidth: yellowNotepadCard.scrollWidth,
        windowHeight: yellowNotepadCard.scrollHeight,
      });

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

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `yellow-notepad_${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast({
          title: 'Exportado',
          description: 'El cuaderno se ha exportado como PNG de alta resolución.',
        });
        setIsExportingPng(false);
      }, 'image/png', 1.0);
    } catch (error: any) {
      console.error('Error al exportar:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo exportar.',
      });
      setIsExportingPng(false);
    }
  }, [toast, id]);

  // Manejar cambios en el contenido
  const handleContentInput = useCallback(() => {
    handleChange();
  }, [handleChange]);

  const handleContentBlur = useCallback(async () => {
    await handleAutoSaveBlur();
  }, [handleAutoSaveBlur]);

  // Manejar búsqueda
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    // Usar ref para evitar dependencias circulares
    const currentContent = typedContentRef.current;
    onUpdate(id, { 
      content: { 
        ...currentContent,
        searchQuery: query 
      } 
    });
  }, [id, onUpdate]); // Eliminar typedContent de dependencias

  // Manejar eliminar
  const handleDelete = useCallback(() => {
    if (isDeleting) return;
    setIsDeleting(true);
    deleteElement(id);
  }, [id, deleteElement, isDeleting]);

  // Manejar cerrar (minimizar o eliminar según necesidad)
  const handleClose = useCallback(() => {
    // Por ahora solo eliminamos, pero podría minimizarse
    handleDelete();
  }, [handleDelete]);

  return (
    <div 
      data-element-id={id}
      className={cn(
        'relative w-full h-full flex flex-col overflow-hidden'
      )}
      style={{
        backgroundColor: '#FFFFE0', // Amarillo claro
        borderRadius: '4px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}
      onMouseDown={(e) => {
        // CRÍTICO: Solo activar drag si el clic NO es en el área de texto editable
        const target = e.target as HTMLElement;
        const isTextArea = target === contentRef.current || contentRef.current?.contains(target);
        if (!isTextArea) {
          // Agregar clase drag-handle dinámicamente solo si no es el área de texto
          e.currentTarget.classList.add('drag-handle');
        } else {
          // Remover drag-handle si es el área de texto
          e.currentTarget.classList.remove('drag-handle');
        }
      }}
    >
      {/* Header - Color #e9e490 */}
      <div
        className="flex items-center justify-between px-4 py-3 drag-handle"
        style={{
          backgroundColor: '#e9e490',
          color: '#000000',
        }}
      >
        {/* Left: Menu icon and title */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-black/10 p-0"
            style={{ color: '#000000' }}
          >
            <Grid3x3 className="h-4 w-4" />
          </Button>
          <div className="flex flex-col">
            <span className="text-sm font-bold leading-tight" style={{ color: '#000000' }}>
              Nuevo
            </span>
            <span className="text-sm font-bold leading-tight" style={{ color: '#000000' }}>
              Notepad
            </span>
          </div>
        </div>

        {/* Center: Search bar */}
        <div className="flex items-center gap-2 flex-1 max-w-xs mx-4">
          <Search className="h-4 w-4" style={{ color: '#000000' }} />
          <Input
            type="text"
            placeholder="Buscar..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="h-7 text-sm bg-transparent border-none text-black placeholder:text-gray-600 focus-visible:ring-0 focus-visible:ring-offset-0"
            style={{
              color: '#000000',
            }}
          />
        </div>

        {/* Right: Action icons */}
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 hover:bg-black/10 p-0"
                style={{ color: '#000000' }}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onMouseDown={(e) => {e.preventDefault(); e.stopPropagation(); handleExportToPng(e)}} disabled={isExportingPng}>
                <FileImage className="mr-2 h-4 w-4" />
                <span>{isExportingPng ? 'Exportando...' : 'Exportar a PNG: alta resolución'}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-black/10 p-0"
            onClick={handleDelete}
            style={{ color: '#000000' }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-black/10 p-0"
            onClick={handleClose}
            style={{ color: '#000000' }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content Area - Amarillo con líneas */}
      <div
        className="flex-1 overflow-y-auto relative"
        style={{
          backgroundColor: '#FFFFE0',
          position: 'relative',
        }}
      >
        {/* Línea vertical izquierda (margen) */}
        <div
          className="absolute left-0 top-0 bottom-0"
          style={{
            width: '15px',
            borderLeft: '1px solid #ADD8E6',
          }}
        />

        {/* Líneas horizontales de fondo - Ajustadas al lineHeight exacto */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            // lineHeight es 25px, así que las líneas deben estar cada 25px
            // La primera línea empieza en 0, luego cada 25px
            backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 24px, #ADD8E6 24px, #ADD8E6 25px)',
            backgroundPosition: '15px 0',
            backgroundSize: '100% 25px', // Exactamente igual al lineHeight
          }}
        />

        {/* Área de texto editable */}
        <div
          ref={contentRef}
          contentEditable
          onInput={handleContentInput}
          onBlur={handleContentBlur}
          onMouseDown={(e) => {
            // CRÍTICO: Prevenir que el drag se active cuando se está seleccionando texto
            // Si el usuario hace clic en el área de texto, no activar el drag
            if (e.target === e.currentTarget || (e.target as HTMLElement).isContentEditable) {
              e.stopPropagation();
            }
          }}
          className={cn(
            'relative z-10 w-full min-h-full',
            'outline-none',
            'text-black',
            'whitespace-pre-wrap',
            'break-words',
            'select-text' // Permitir selección de texto
          )}
          style={{
            paddingLeft: '20px', // Espacio después de la línea vertical (15px línea + 5px espacio)
            paddingRight: '15px',
            paddingTop: '12px', // Padding superior para alinear con la primera línea
            paddingBottom: '12px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '14px',
            lineHeight: '25px', // CRÍTICO: Debe coincidir exactamente con el backgroundSize de las líneas
            color: '#000000',
            minHeight: '100%',
            userSelect: 'text', // Permitir selección de texto
            WebkitUserSelect: 'text',
          }}
        />

        {/* Indicador de guardado */}
        {isSelected && (
          <div className="absolute top-2 right-2 z-20">
            <SaveStatusIndicator status={saveStatus} size="sm" />
          </div>
        )}
      </div>
    </div>
  );
}
