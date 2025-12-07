'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { CommonElementProps, AccordionContent, AccordionItem } from '@/lib/types';
import { Accordion, AccordionItem as AccordionItemComponent, AccordionTrigger, AccordionContent as AccordionContentComponent } from '@/components/ui/accordion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, X, GripVertical, Palette } from 'lucide-react';
import { useAutoSave } from '@/hooks/use-auto-save';
import { cn } from '@/lib/utils';
import { useDictationInput } from '@/hooks/use-dictation-input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TwitterPicker } from 'react-color';

export default function AccordionElement(props: CommonElementProps) {
  const {
    id,
    content,
    properties,
    isSelected,
    onUpdate,
    isListening,
    liveTranscript,
    finalTranscript,
    interimTranscript
  } = props;

  const safeProperties = typeof properties === 'object' && properties !== null ? properties : {};
  const accordionContent: AccordionContent = typeof content === 'object' && content !== null && 'items' in content 
    ? (content as AccordionContent) 
    : { items: [{ id: '1', title: 'Nuevo Item', content: '' }] };

  const [items, setItems] = useState<AccordionItem[]>(accordionContent.items || []);
  const [openItems, setOpenItems] = useState<string[]>(items.filter(item => item.isOpen).map(item => item.id));

  // Ref para almacenar el contenido anterior y evitar loops
  const prevContentRef = useRef<string>('');
  
  useEffect(() => {
    // Crear string estable para comparar
    const contentString = JSON.stringify(content);
    
    // Solo ejecutar si realmente cambió
    if (prevContentRef.current === contentString) {
      return;
    }
    
    prevContentRef.current = contentString;
    
    if (typeof content === 'object' && content !== null && 'items' in content) {
      const newContent = content as AccordionContent;
      setItems(newContent.items || []);
      setOpenItems(newContent.items.filter(item => item.isOpen).map(item => item.id));
    }
  }, [content]);

  const handleAddItem = () => {
    const newItem: AccordionItem = {
      id: Date.now().toString(),
      title: 'Nuevo Item',
      content: '',
      isOpen: false
    };
    const newItems = [...items, newItem];
    setItems(newItems);
    onUpdate(id, { content: { items: newItems } });
  };

  const handleDeleteItem = (itemId: string) => {
    const newItems = items.filter(item => item.id !== itemId);
    setItems(newItems);
    setOpenItems(openItems.filter(id => id !== itemId));
    onUpdate(id, { content: { items: newItems } });
  };

  const handleUpdateItem = (itemId: string, updates: Partial<AccordionItem>) => {
    const newItems = items.map(item => 
      item.id === itemId ? { ...item, ...updates } : item
    );
    setItems(newItems);
    onUpdate(id, { content: { items: newItems } });
  };

  const handleValueChange = (value: string | string[]) => {
    const newOpenItems = Array.isArray(value) ? value : value ? [value] : [];
    setOpenItems(newOpenItems);
    const newItems = items.map(item => ({
      ...item,
      isOpen: newOpenItems.includes(item.id)
    }));
    onUpdate(id, { content: { items: newItems } });
  };

  const safeSize = safeProperties.size || { width: 320, height: 240 };
  const accordionWidth = typeof safeSize.width === 'number' ? safeSize.width : 320;
  const accordionHeight = typeof safeSize.height === 'number' ? safeSize.height : 240;

  return (
    <Card className={cn(
      "w-full h-full p-3 bg-white shadow-sm drag-handle",
      isSelected && "ring-2 ring-primary"
    )} style={{ 
      width: `${accordionWidth}px`, 
      height: `${accordionHeight}px`,
      backgroundColor: safeProperties.backgroundColor || '#ffffff'
    }}>
      <div className="flex items-center justify-between mb-2 drag-handle">
        <div className="flex items-center gap-2 drag-handle">
          <GripVertical className="h-4 w-4 text-slate-400 cursor-move drag-handle" />
          <h3 className="font-semibold text-slate-800 text-sm drag-handle">Acordeón</h3>
        </div>
        <div className="flex items-center gap-1">
          {isSelected && (
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={(e) => e.stopPropagation()}>
                  <Palette className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" onClick={(e) => e.stopPropagation()}>
                <TwitterPicker
                  color={safeProperties.backgroundColor || '#ffffff'}
                  onChange={(color) => onUpdate(id, { properties: { ...safeProperties, backgroundColor: color.hex } })}
                />
              </PopoverContent>
            </Popover>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleAddItem}
            className="h-7 w-7 p-0"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Accordion 
        type="multiple" 
        value={openItems}
        onValueChange={handleValueChange}
        className="w-full"
      >
        {items.map((item) => (
          <AccordionItemComponent key={item.id} value={item.id}>
            <div className="flex items-center gap-2">
              <AccordionTrigger className="flex-1 text-left" onClick={(e) => e.stopPropagation()}>
                <EditableTitle
                  value={item.title}
                  onChange={(newTitle) => handleUpdateItem(item.id, { title: newTitle })}
                  isListening={isListening}
                  liveTranscript={liveTranscript}
                  finalTranscript={finalTranscript}
                />
              </AccordionTrigger>
              {isSelected && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteItem(item.id);
                  }}
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <AccordionContentComponent>
              <EditableContent
                value={item.content}
                onChange={(newContent) => handleUpdateItem(item.id, { content: newContent })}
                isListening={isListening}
                liveTranscript={liveTranscript}
                finalTranscript={finalTranscript}
                interimTranscript={interimTranscript}
                isSelected={isSelected}
              />
            </AccordionContentComponent>
          </AccordionItemComponent>
        ))}
      </Accordion>

      {items.length === 0 && (
        <div className="text-center text-slate-400 py-8">
          <p>No hay items. Haz clic en + para agregar uno.</p>
        </div>
      )}
    </Card>
  );
}

function EditableTitle({ 
  value, 
  onChange, 
  isListening, 
  liveTranscript, 
  finalTranscript,
  interimTranscript,
}: { 
  value: string; 
  onChange: (value: string) => void;
  isListening?: boolean;
  liveTranscript?: string;
  finalTranscript?: string;
  interimTranscript?: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      const len = inputRef.current.value.length;
      inputRef.current.setSelectionRange(len, len);
    }
  }, [isEditing]);

  // Soporte para dictado usando hook helper
  useDictationInput({
    elementRef: inputRef as React.RefObject<HTMLElement | HTMLInputElement | HTMLTextAreaElement>,
    isListening: (isListening && isEditing) || false,
    liveTranscript: liveTranscript || '',
    finalTranscript: finalTranscript || '',
    interimTranscript: interimTranscript || '',
    isSelected: isEditing, // Solo cuando está editando
    enabled: isEditing, // Solo cuando está en modo edición
  });

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setIsEditing(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            setIsEditing(false);
          }
        }}
        className="flex-1 bg-transparent border-none outline-none font-medium text-sm"
        onClick={(e) => e.stopPropagation()}
        onFocus={(e) => {
          const len = e.target.value.length;
          e.target.setSelectionRange(len, len);
        }}
      />
    );
  }

  return (
    <span 
      onClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
      className="cursor-text text-sm"
    >
      {value || 'Nuevo Item'}
    </span>
  );
}

function EditableContent({ 
  value, 
  onChange,
  isListening,
  liveTranscript,
  finalTranscript,
  interimTranscript,
  isSelected,
}: { 
  value: string; 
  onChange: (value: string) => void;
  isListening?: boolean;
  liveTranscript?: string;
  finalTranscript?: string;
  interimTranscript?: string;
  isSelected?: boolean;
}) {
  const editorRef = useRef<HTMLDivElement>(null);

  const { handleBlur, handleChange } = useAutoSave({
    getContent: () => {
      const html = editorRef.current?.innerHTML || '';
      // Normalizar HTML para comparación consistente
      return html.replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim();
    },
    onSave: async (newContent) => {
      // Normalizar también el valor actual para comparar
      const normalizedValue = (value || '').replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim();
      if (newContent !== normalizedValue) {
        await onChange(newContent);
      }
    },
    debounceMs: 500,
    compareContent: (oldContent, newContent) => {
      // Normalizar ambos para comparación
      const normalizedOld = (oldContent || '').replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim();
      const normalizedNew = (newContent || '').replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim();
      return normalizedOld === normalizedNew;
    },
  });

  // Ref para almacenar el valor anterior y evitar loops
  const prevValueRef = useRef<string>('');
  
  useEffect(() => {
    // Solo ejecutar si realmente cambió el valor
    if (prevValueRef.current === value) {
      return;
    }
    prevValueRef.current = value;
    
    // CRÍTICO: Solo actualizar si el elemento NO está enfocado Y NO hay dictado activo
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      const isFocused = document.activeElement === editorRef.current;
      const isDictating = isListening && (liveTranscript || finalTranscript || interimTranscript);
      
      // Si está enfocado O hay dictado activo, NO actualizar innerHTML (preservar cursor y texto del dictado)
      if (isFocused || isDictating) {
        return;
      }
      
      // Guardar posición del cursor antes de actualizar
      const selection = window.getSelection();
      let savedRange: Range | null = null;
      
      if (selection && selection.rangeCount > 0) {
        savedRange = selection.getRangeAt(0).cloneRange();
      }
      
      editorRef.current.innerHTML = value || '';
      
      // Restaurar cursor solo si había uno guardado
      if (savedRange && editorRef.current.firstChild) {
        try {
          const textNode = editorRef.current.firstChild;
          if (textNode.nodeType === Node.TEXT_NODE) {
            const maxPos = textNode.textContent?.length || 0;
            const newPos = Math.min(savedRange.startOffset, maxPos);
            const newRange = document.createRange();
            newRange.setStart(textNode, newPos);
            newRange.collapse(true);
            selection?.removeAllRanges();
            selection?.addRange(newRange);
          }
        } catch (e) {
          // Si falla restaurar cursor, no hacer nada
        }
      }
    }
  }, [value, isListening, liveTranscript, finalTranscript, interimTranscript]);

  // Soporte para dictado usando hook helper
  useDictationInput({
    elementRef: editorRef as React.RefObject<HTMLElement | HTMLInputElement | HTMLTextAreaElement>,
    isListening: isListening || false,
    liveTranscript: liveTranscript || '',
    finalTranscript: finalTranscript || '',
    interimTranscript: interimTranscript || '',
    isSelected: isSelected || false,
    enabled: true,
  });

  return (
    <div
      ref={editorRef}
      contentEditable
      onBlur={handleBlur}
      onInput={handleChange}
      className="min-h-[50px] p-2 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
      dangerouslySetInnerHTML={{ __html: value || '' }}
    />
  );
}
