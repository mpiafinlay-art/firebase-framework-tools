// src/components/canvas/formatting-toolbar.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Rnd } from 'react-rnd';
import type { WithId, CanvasElement } from '@/lib/types';
import {
  MoreVertical,
  Tag,
  Type,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  Calendar,
  Eraser,
  X,
  Move,
  RectangleHorizontal,
  GripVertical,
  MapPin,
  Link as LinkIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Search,
  ChevronDown,
  Paintbrush,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button as UIButton } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ElementType } from '@/lib/types';

export interface FormattingToolbarProps {
  isOpen: boolean;
  onClose: () => void;
  onAddComment: () => void;
  onEditComment?: (comment: WithId<CanvasElement>) => void;
  isMobileSheet?: boolean;
  elements: WithId<CanvasElement>[];
  onLocateElement: (id: string) => void;
  onPanToggle: () => void;
  addElement?: (type: ElementType, props?: any) => Promise<string>;
  isPanningActive?: boolean;
}

const FormattingToolbar: React.FC<FormattingToolbarProps> = ({
  isOpen,
  onClose,
  onAddComment,
  onEditComment,
  isMobileSheet,
  elements,
  onLocateElement,
  onPanToggle,
  addElement,
  isPanningActive = false,
}) => {
  const [popoverOpen, setPopoverOpen] = useState<'fontSize' | 'underlineColor' | 'textColor' | null>(null);
  const [fontSize, setFontSize] = useState('18px');
  const [rndPosition, setRndPosition] = useState({ x: 0, y: 0 });
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  // Inicializar posición centrada arriba
  useEffect(() => {
    if (isOpen && !isMobileSheet) {
      const savedPosition = localStorage.getItem('formattingToolbarPosition');
      if (savedPosition) {
        try {
          setRndPosition(JSON.parse(savedPosition));
        } catch (e) {
          console.error('Failed to load formatting toolbar position', e);
        }
      } else {
        // Centrar arriba
        const centerX = (window.innerWidth - 600) / 2; // 600px es el ancho aproximado reducido 20%
        setRndPosition({ x: centerX, y: 20 });
      }
    }
  }, [isOpen, isMobileSheet]);

  const onDragStop = (e: any, d: { x: number; y: number }) => {
    const newPosition = { x: d.x, y: d.y };
    setRndPosition(newPosition);
    try {
      localStorage.setItem('formattingToolbarPosition', JSON.stringify(newPosition));
    } catch (error) {
      console.error('Failed to save formatting toolbar position', error);
    }
  };

  const handleAddLienzo = async () => {
    if (addElement) {
      try {
        await addElement('container', {
          content: { title: 'Lienzo', elementIds: [] },
          properties: {
            position: { x: 100, y: 100 },
            size: { width: 794, height: 1021 },
            backgroundColor: 'white',
          },
        });
      } catch (error) {
        console.error('Error creating lienzo:', error);
      }
    }
  };

  const handleFormat = (e: React.MouseEvent, command: string, value?: string) => {
    e.preventDefault();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement && (activeElement.isContentEditable || activeElement.tagName === 'DIV')) {
        activeElement.focus();
        if (value) {
          document.execCommand(command, false, value);
        } else {
          document.execCommand(command, false);
        }
      }
      return;
    }

    if (value) {
      document.execCommand(command, false, value);
    } else {
      document.execCommand(command, false);
    }
    setPopoverOpen(null);
  };

  const applyColoredUnderline = (e: React.MouseEvent, color: string) => {
    e.preventDefault();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return;
    }
    const range = selection.getRangeAt(0);
    const span = document.createElement('span');
    span.style.textDecoration = 'underline';
    span.style.textDecorationColor = color;
    span.style.textDecorationThickness = '2px';
    span.appendChild(range.extractContents());
    range.insertNode(span);
    setPopoverOpen(null);
  };

  const applyTextColor = (e: React.MouseEvent, color: string) => {
    e.preventDefault();
    e.stopPropagation();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      // Si no hay selección, envolver todo el contenido en un span con el color
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement && activeElement.isContentEditable) {
        // Si el elemento ya tiene un solo hijo span con color, actualizar ese span
        const children = Array.from(activeElement.childNodes);
        if (children.length === 1 && children[0].nodeType === Node.ELEMENT_NODE) {
          const child = children[0] as HTMLElement;
          if (child.tagName === 'SPAN' && child.style.color) {
            child.style.color = color;
            activeElement.dispatchEvent(new Event('input', { bubbles: true }));
            setPopoverOpen(null);
            return;
          }
        }
        // Envolver todo el contenido en un span con el color
        const span = document.createElement('span');
        span.style.color = color;
        while (activeElement.firstChild) {
          span.appendChild(activeElement.firstChild);
        }
        activeElement.appendChild(span);
        // Mover cursor al final
        const range = document.createRange();
        range.selectNodeContents(span);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
        activeElement.dispatchEvent(new Event('input', { bubbles: true }));
      }
      setPopoverOpen(null);
      return;
    }
    
    if (selection.isCollapsed) {
      // Si solo hay cursor, envolver el contenido del elemento en un span con el color
      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;
      const element = container.nodeType === Node.TEXT_NODE 
        ? (container.parentElement as HTMLElement)
        : (container as HTMLElement);
      if (element && element.isContentEditable) {
        // Verificar si ya tiene un span con color
        const children = Array.from(element.childNodes);
        if (children.length === 1 && children[0].nodeType === Node.ELEMENT_NODE) {
          const child = children[0] as HTMLElement;
          if (child.tagName === 'SPAN' && child.style.color) {
            child.style.color = color;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            setPopoverOpen(null);
            return;
          }
        }
        // Envolver contenido en span con color
        const span = document.createElement('span');
        span.style.color = color;
        while (element.firstChild) {
          span.appendChild(element.firstChild);
        }
        element.appendChild(span);
        // Mover cursor al final
        const newRange = document.createRange();
        newRange.selectNodeContents(span);
        newRange.collapse(false);
        selection.removeAllRanges();
        selection.addRange(newRange);
        element.dispatchEvent(new Event('input', { bubbles: true }));
      }
      setPopoverOpen(null);
      return;
    }
    
    const range = selection.getRangeAt(0);
    const span = document.createElement('span');
    span.style.color = color;
    try {
      span.appendChild(range.extractContents());
      range.insertNode(span);
      // Mover cursor después del span
      range.setStartAfter(span);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      // Disparar evento input para guardar
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement) {
        activeElement.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } catch (err) {
      console.error('Error aplicando color:', err);
    }
    setPopoverOpen(null);
  };

  const handleInsertDate = (e: React.MouseEvent) => {
    e.preventDefault();
    const span = document.createElement('span');
    span.style.color = '#a0a1a6';
    span.textContent = `-- ${format(new Date(), 'dd/MM/yy')} `;
    document.execCommand('insertHTML', false, span.outerHTML);
  };

  const clearFormatting = (e: React.MouseEvent) => {
    e.preventDefault();
    document.execCommand('removeFormat', false);
    
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;
      if (container.nodeType === Node.ELEMENT_NODE) {
        const element = container as HTMLElement;
        const spans = element.querySelectorAll('span[style*="text-decoration"]');
        spans.forEach(span => {
          const parent = span.parentNode;
          if (parent) {
            parent.replaceChild(document.createTextNode(span.textContent || ''), span);
            parent.normalize();
          }
        });
      }
    }
  };

  const handleList = (e: React.MouseEvent) => {
    e.preventDefault();
    // Toggle entre lista ordenada y desordenada
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;
      if (container.nodeType === Node.ELEMENT_NODE) {
        const element = container as HTMLElement;
        if (element.tagName === 'UL' || element.tagName === 'OL') {
          document.execCommand('insertUnorderedList', false);
        } else {
          document.execCommand('insertUnorderedList', false);
        }
      } else {
        document.execCommand('insertUnorderedList', false);
      }
    }
  };

  if (!isOpen) {
    return null;
  }

  // Clases Tailwind para el toolbar (fondo negro, botones blancos)
  // Reducido 20%: todos los tamaños reducidos al 80%
  const toolbarClassName = cn(
    "bg-black text-white py-1.5 px-2.5",
    "flex items-center justify-center w-full min-h-[38px] gap-0.5",
    "text-sm"
  );

  // Clases Tailwind para botones blancos redondeados (reducidos 20%)
  const whiteButtonClassName = cn(
    "bg-white border-none rounded-md px-2.5 py-1.5",
    "cursor-pointer flex items-center justify-center",
    "min-w-[29px] h-7 transition-colors",
    "hover:bg-gray-100"
  );

  // Clases Tailwind para iconos negros (reducidos 20%)
  const iconClassName = "w-[14px] h-[14px] text-black";

  // Clases Tailwind para cuadrados gris oscuro (reducidos 20%)
  const darkSquareClassName = cn(
    "bg-[#2a2a2a] border-none rounded",
    "cursor-pointer flex items-center justify-center",
    "w-7 h-7 p-1.5 transition-colors",
    "hover:bg-[#3a3a3a]"
  );

  // Detectar si el elemento seleccionado es un comment
  const selectedComment = elements.length > 0 && elements[0]?.type === 'comment' ? elements[0] : null;

  const toolbarContent = (
    <div className={toolbarClassName}>
      {/* 0. MapPin (Fijar posición) - Botón blanco - SOLO para elementos comment */}
      {selectedComment && onEditComment && (
        <button
          className={whiteButtonClassName}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onEditComment(selectedComment);
          }}
          title="Fijar posición en el tablero / Editar Etiqueta"
        >
          <MapPin className={iconClassName} />
        </button>
      )}

      {/* 1. Tres puntos verticales (MoreVertical) - Cuadrado gris oscuro */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button 
            className={darkSquareClassName} 
            title="Más opciones"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <MoreVertical className="w-[14px] h-[14px] text-white" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
            <span>Opciones</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 2. Tag (Etiqueta/Marcador) - Botón blanco */}
      <button
        className={whiteButtonClassName}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (onAddComment) {
            onAddComment();
          }
        }}
        title="Crear etiqueta de posición"
      >
        <Tag className={iconClassName} />
      </button>

      {/* 3. T (Tamaño de Fuente) - Botón blanco con Popover */}
      <Popover open={popoverOpen === 'fontSize'} onOpenChange={(open) => setPopoverOpen(open ? 'fontSize' : null)}>
        <PopoverTrigger asChild>
          <button
            className={whiteButtonClassName}
            title="Tamaño de Texto"
            onMouseDown={(e) => e.preventDefault()}
          >
            <Type className={iconClassName} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2 bg-white" onMouseDown={(e) => e.preventDefault()}>
          <div className="space-y-1">
            {['12px', '14px', '16px', '18px', '20px', '24px', '32px'].map((size) => (
              <button
                key={size}
                className="w-full text-left px-2 py-1 text-sm hover:bg-gray-100 rounded"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setFontSize(size);
                  const selection = window.getSelection();
                  if (selection && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    const span = document.createElement('span');
                    span.style.fontSize = size;
                    try {
                      range.surroundContents(span);
                    } catch (e) {
                      span.appendChild(range.extractContents());
                      range.insertNode(span);
                    }
                  }
                  setPopoverOpen(null);
                }}
              >
                {size}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Separador visual */}
      <div className="w-px h-6 bg-white/30 mx-1" />

      {/* 4. Link (Enlaces) - Botón blanco */}
      <button
        className={whiteButtonClassName}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const selection = window.getSelection();
          const url = prompt('Ingresa la URL del enlace:');
          if (url) {
            if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
              // Hay texto seleccionado, convertirlo en enlace
              const range = selection.getRangeAt(0);
              const link = document.createElement('a');
              link.href = url;
              link.target = '_blank';
              link.rel = 'noopener noreferrer';
              link.appendChild(range.extractContents());
              range.insertNode(link);
            } else {
              // No hay selección, insertar URL como texto con enlace
              const link = document.createElement('a');
              link.href = url;
              link.target = '_blank';
              link.rel = 'noopener noreferrer';
              link.textContent = url;
              document.execCommand('insertHTML', false, link.outerHTML);
            }
          }
        }}
        title="Insertar Enlace"
      >
        <LinkIcon className={iconClassName} />
      </button>

      {/* Separador visual */}
      <div className="w-px h-6 bg-white/30 mx-1" />

      {/* 5. Pincel (Color de Texto) - Botón blanco con Popover de colores */}
      <Popover open={popoverOpen === 'textColor'} onOpenChange={(open) => setPopoverOpen(open ? 'textColor' : null)}>
        <PopoverTrigger asChild>
          <button
            className={whiteButtonClassName}
            title="Color de Texto"
            onMouseDown={(e) => e.preventDefault()}
          >
            <Paintbrush className={iconClassName} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2 bg-white" onMouseDown={(e) => e.preventDefault()}>
          <div className="text-xs text-gray-600 mb-2 px-1">Color de texto</div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { value: '#14b8a6' }, // Teal
              { value: '#f97316' }, // Orange-red
              { value: '#84cc16' }, // Lime green
              { value: '#eab308' }, // Yellow
              { value: '#f59e0b' }, // Goldenrod
              { value: '#3b82f6' }, // Bright blue
              { value: '#1f2937' }, // Dark gray
              { value: '#475569' }, // Slate blue
            ].map((color, idx) => (
              <button
                key={idx}
                className="w-8 h-8 rounded border border-gray-300 hover:scale-110 transition-transform"
                style={{ backgroundColor: color.value }}
                onMouseDown={(e) => applyTextColor(e, color.value)}
                title={`Color ${idx + 1}`}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Separador visual */}
      <div className="w-px h-6 bg-white/30 mx-1" />

      {/* 5.5. Destacador (Highlight) - Botón blanco con Popover de colores - Solo si hay texto seleccionado */}
      {(() => {
        const selection = window.getSelection();
        const hasSelection = selection && selection.rangeCount > 0 && !selection.isCollapsed;
        if (!hasSelection) return null;
        return (
          <Popover open={popoverOpen === 'highlight'} onOpenChange={(open) => setPopoverOpen(open ? 'highlight' : null)}>
            <PopoverTrigger asChild>
              <button
                className={whiteButtonClassName}
                title="Resaltar Texto"
                onMouseDown={(e) => e.preventDefault()}
              >
                <Paintbrush className={iconClassName} />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2 bg-white" onMouseDown={(e) => e.preventDefault()}>
              <div className="text-xs text-gray-600 mb-2 px-1">Color de fondo</div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: '#fef08a' }, // Amarillo pastel
                  { value: '#fde68a' }, // Amarillo claro
                  { value: '#fed7aa' }, // Naranja pastel
                  { value: '#fecaca' }, // Rosa pastel
                  { value: '#fbcfe8' }, // Rosa claro
                  { value: '#e9d5ff' }, // Morado pastel
                  { value: '#ddd6fe' }, // Morado claro
                  { value: '#c7d2fe' }, // Azul pastel
                ].map((color, idx) => (
                  <button
                    key={idx}
                    className="w-8 h-8 rounded border border-gray-300 hover:scale-110 transition-transform"
                    style={{ backgroundColor: color.value }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      const sel = window.getSelection();
                      if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
                        const range = sel.getRangeAt(0);
                        const span = document.createElement('span');
                        span.style.backgroundColor = color.value;
                        try {
                          span.appendChild(range.extractContents());
                          range.insertNode(span);
                          range.setStartAfter(span);
                          range.collapse(true);
                          sel.removeAllRanges();
                          sel.addRange(range);
                          const activeElement = document.activeElement as HTMLElement;
                          if (activeElement) {
                            activeElement.dispatchEvent(new Event('input', { bubbles: true }));
                          }
                        } catch (err) {
                          console.error('Error aplicando resaltado:', err);
                        }
                      }
                      setPopoverOpen(null);
                    }}
                    title={`Resaltado ${idx + 1}`}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>
        );
      })()}

      {/* Separador visual */}
      <div className="w-px h-6 bg-white/30 mx-1" />

      {/* 6. U subrayado (Underline) - Botón blanco con Popover de colores */}
      <Popover open={popoverOpen === 'underlineColor'} onOpenChange={(open) => setPopoverOpen(open ? 'underlineColor' : null)}>
        <PopoverTrigger asChild>
          <button
            className={whiteButtonClassName}
            title="Subrayado"
            onMouseDown={(e) => e.preventDefault()}
          >
            <Underline className={iconClassName} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2 bg-white" onMouseDown={(e) => e.preventDefault()}>
          <div className="text-xs text-gray-600 mb-2 px-1">Subrayado de</div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { value: '#14b8a6' }, // Teal
              { value: '#f97316' }, // Orange-red
              { value: '#84cc16' }, // Lime green
              { value: '#eab308' }, // Yellow
              { value: '#f59e0b' }, // Goldenrod
              { value: '#3b82f6' }, // Bright blue
              { value: '#1f2937' }, // Dark gray
              { value: '#475569' }, // Slate blue
            ].map((color, idx) => (
              <button
                key={idx}
                className="w-8 h-8 rounded border border-gray-300 hover:scale-110 transition-transform"
                style={{ backgroundColor: color.value }}
                onMouseDown={(e) => applyColoredUnderline(e, color.value)}
                title={`Color ${idx + 1}`}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* 7. B (Bold) - Botón blanco */}
      <button
        className={whiteButtonClassName}
        onMouseDown={(e) => handleFormat(e, 'bold')}
        title="Negrita"
      >
        <Bold className={iconClassName} />
      </button>

      {/* 8. I (Italic) - Botón blanco */}
      <button
        className={whiteButtonClassName}
        onMouseDown={(e) => handleFormat(e, 'italic')}
        title="Cursiva"
      >
        <Italic className={iconClassName} />
      </button>

      {/* 9. S tachado (Strikethrough) - Botón blanco */}
      <button
        className={whiteButtonClassName}
        onMouseDown={(e) => handleFormat(e, 'strikeThrough')}
        title="Tachado"
      >
        <Strikethrough className={iconClassName} />
      </button>

      {/* Separador visual */}
      <div className="w-px h-6 bg-white/30 mx-1" />

      {/* 10-13. Alinear - Botón único con desplegable */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={whiteButtonClassName}
            title="Alinear Texto"
          >
            <AlignLeft className={iconClassName} />
            <ChevronDown className="h-3 w-3 ml-0.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onMouseDown={(e) => handleFormat(e, 'justifyLeft')}>
            <AlignLeft className="h-4 w-4 mr-2" />
            Alinear Izquierda
          </DropdownMenuItem>
          <DropdownMenuItem onMouseDown={(e) => handleFormat(e, 'justifyCenter')}>
            <AlignCenter className="h-4 w-4 mr-2" />
            Centrar
          </DropdownMenuItem>
          <DropdownMenuItem onMouseDown={(e) => handleFormat(e, 'justifyRight')}>
            <AlignRight className="h-4 w-4 mr-2" />
            Alinear Derecha
          </DropdownMenuItem>
          <DropdownMenuItem onMouseDown={(e) => handleFormat(e, 'justifyFull')}>
            <AlignJustify className="h-4 w-4 mr-2" />
            Justificar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Separador visual */}
      <div className="w-px h-6 bg-white/30 mx-1" />

      {/* 14. Calendario - Botón blanco */}
      <button
        className={whiteButtonClassName}
        onClick={handleInsertDate}
        title="Insertar Fecha"
      >
        <Calendar className={iconClassName} />
      </button>

      {/* Separador visual */}
      <div className="w-px h-6 bg-white/30 mx-1" />

      {/* 16. Borrador (Eraser) - Botón blanco */}
      <button
        className={whiteButtonClassName}
        onMouseDown={clearFormatting}
        title="Limpiar Formato"
      >
        <Eraser className={iconClassName} />
      </button>

      {/* 12. Mover - Botón blanco (trasladado del menú principal) */}
      <button
        className={cn(whiteButtonClassName, isPanningActive && 'bg-gray-200')}
        onClick={onPanToggle}
        title="Mover"
      >
        <Move className={iconClassName} />
      </button>

      {/* 13. Lienzo - Botón blanco (trasladado del menú principal) */}
      <button
        className={whiteButtonClassName}
        onClick={handleAddLienzo}
        title="Lienzo"
      >
        <RectangleHorizontal className={iconClassName} />
      </button>

      {/* 14. X - Cuadrado gris oscuro */}
      <button
        className={darkSquareClassName}
        onClick={onClose}
        title="Cerrar"
      >
        <X className="w-[14px] h-[14px] text-white" />
      </button>
    </div>
  );

  if (isMobileSheet) {
    return toolbarContent;
  }

  // Menú format siempre abierto arriba, arrastrable con Rnd
  return (
    <Rnd
      size={{ width: 'auto', height: 'auto' }}
      position={rndPosition}
      onDragStop={onDragStop}
      dragHandleClassName="drag-handle"
      bounds="window"
      enableResizing={false}
      className="z-[60000] pointer-events-auto"
    >
      <div className="drag-handle cursor-grab active:cursor-grabbing py-1 text-slate-800 flex justify-center mb-1">
        <GripVertical className="size-4" />
      </div>
      {toolbarContent}
    </Rnd>
  );
};

export default FormattingToolbar;
