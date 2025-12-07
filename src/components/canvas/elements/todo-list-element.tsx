'use client';

import React, { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import type { CommonElementProps, TodoItem, TodoContent } from '@/lib/types';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  GripVertical,
  Plus,
  Trash2,
  Palette,
  MoreVertical,
  Download,
  Copy,
  X,
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAutoSave } from '@/hooks/use-auto-save';
import { SaveStatusIndicator } from '@/components/canvas/save-status-indicator';
import { insertDictationTextToInput } from '@/lib/dictation-helper';

// Colores disponibles para el fondo de la lista
const COLOR_PALETTE = [
  { name: 'white', label: 'Blanco', value: '#ffffff' },
  { name: 'yellow', label: 'Amarillo', value: '#fffb8b' },
  { name: 'pink', label: 'Rosa', value: '#ffc2d4' },
  { name: 'blue', label: 'Azul', value: '#bce8f1' },
  { name: 'green', label: 'Verde', value: '#d4edda' },
  { name: 'orange', label: 'Naranja', value: '#ffeeba' },
  { name: 'purple', label: 'Morado', value: '#e9d5ff' },
];

export default function TodoListElement(props: CommonElementProps) {
  const {
    id,
    content,
    properties,
    onUpdate,
    onEditElement,
    isSelected,
    deleteElement,
    onLocateElement,
    onEditComment,
    isListening,
    liveTranscript,
    finalTranscript,
    interimTranscript
  } = props;

  const { toast } = useToast();
  const cardRef = useRef<HTMLDivElement>(null);
  const [newItemText, setNewItemText] = useState('');
  const [colorPopoverOpen, setColorPopoverOpen] = useState(false);

  const safeProperties = typeof properties === 'object' && properties !== null ? properties : {};
  const backgroundColor = safeProperties.backgroundColor || '#ffffff';
  
  // Type guard para TodoContent
  const todoContent: TodoContent = (typeof content === 'object' && content !== null && 'items' in content)
    ? content as TodoContent
    : { title: 'Lista de Tareas', items: [] };
  const { title, items } = todoContent;

  // Hook de autoguardado robusto para la lista de tareas
  const { saveStatus, handleChange: handleAutoSaveChange } = useAutoSave({
    getContent: () => todoContent,
    onSave: async (newContent) => {
      // Comparar serializando para detectar cambios profundos
      const currentSerialized = JSON.stringify(todoContent);
      const newSerialized = JSON.stringify(newContent);
      if (currentSerialized !== newSerialized) {
        onUpdate(id, { content: newContent });
      }
    },
    debounceMs: 2000,
    compareContent: (oldContent, newContent) => {
      return JSON.stringify(oldContent) === JSON.stringify(newContent);
    },
  });

  const handleToggleItem = (index: number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], completed: !newItems[index].completed };
    const updatedContent: TodoContent = { ...todoContent, items: newItems };
    onUpdate(id, { content: updatedContent });
    handleAutoSaveChange(); // Programar auto-save
  };

  const handleItemTextChange = (index: number, text: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], text };
    const updatedContent: TodoContent = { ...todoContent, items: newItems };
    onUpdate(id, { content: updatedContent });
    handleAutoSaveChange(); // Programar auto-save
  };

  const handleAddItem = () => {
    if (newItemText.trim() !== '') {
      const newItems = [...items, { id: `item-${Date.now()}`, text: newItemText, completed: false }];
      const updatedContent: TodoContent = { ...todoContent, items: newItems };
      onUpdate(id, { content: updatedContent });
      setNewItemText('');
      handleAutoSaveChange(); // Programar auto-save
    }
  };

  const handleDeleteItem = (index: number) => {
    const newItems = items.filter((_: TodoItem, i: number) => i !== index);
    const updatedContent: TodoContent = { ...todoContent, items: newItems };
    onUpdate(id, { content: updatedContent });
    handleAutoSaveChange(); // Programar auto-save
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const updatedContent: TodoContent = { ...todoContent, title: e.target.value };
    onUpdate(id, { content: updatedContent });
    handleAutoSaveChange(); // Programar auto-save
  };

  const handleColorChange = (color: string) => {
    onUpdate(id, { properties: { ...safeProperties, backgroundColor: color } });
    setColorPopoverOpen(false);
  };

  const handleCopyAsText = async () => {
    try {
      let text = `*${title || 'Lista de Tareas'}*\n\n`;
      
      items.forEach((item: TodoItem) => {
        if (item.completed) {
          text += `✅ ${item.text}\n`;
        } else {
          text += `⬜ ${item.text}\n`;
        }
      });

      await navigator.clipboard.writeText(text);
      toast({
        title: 'Lista copiada',
        description: 'La lista se ha copiado al portapapeles.',
      });
    } catch (error) {
      console.error('Error al copiar:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo copiar la lista.',
      });
    }
  };

  const handleExportPNG = async () => {
    try {
      if (!cardRef.current) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'No se pudo capturar el elemento.',
        });
        return;
      }

      // Mostrar toast de carga
      toast({
        title: 'Exportando...',
        description: 'Generando imagen PNG de la lista.',
      });

      // Capturar el elemento usando html2canvas con resolución reducida 30%
      const canvas = await html2canvas(cardRef.current, {
        scale: 2.1, // 30% menos que 3x (solo para lista de tareas)
        backgroundColor: backgroundColor,
        useCORS: true,
        logging: false,
        allowTaint: false,
      });

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
        link.download = `${title || 'lista'}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        // Mostrar toast de éxito
        toast({
          title: 'Exportado',
          description: 'La lista se ha exportado como PNG.',
        });
      }, 'image/png');
    } catch (error: any) {
      console.error('Error al exportar:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo exportar la lista.',
      });
    }
  };

  const handleDeleteList = () => {
    if (deleteElement) {
      deleteElement(id);
    }
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const newItems = Array.from(items);
    const [reorderedItem] = newItems.splice(result.source.index, 1);
    newItems.splice(result.destination.index, 0, reorderedItem);
    const updatedContent: TodoContent = { ...todoContent, items: newItems };
    onUpdate(id, { content: updatedContent });
    handleAutoSaveChange(); // Programar auto-save después de reordenar
  };

  // Soporte para dictado: insertar texto cuando está escuchando y un input está enfocado
  const dictationStateRef = useRef<{ lastInsertedText: string; lastFinalText: string }>({ lastInsertedText: '', lastFinalText: '' });
  
  useEffect(() => {
    if (!isListening || !isSelected) {
      // Resetear estado cuando se detiene el dictado
      if (!isListening) {
        dictationStateRef.current = { lastInsertedText: '', lastFinalText: '' };
      }
      return;
    }

    if (!finalTranscript && !interimTranscript) return;

    const activeElement = document.activeElement;
    if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
      const input = activeElement as HTMLInputElement | HTMLTextAreaElement;
      // Verificar que el input pertenece a este elemento (está dentro del card)
      if (cardRef.current && cardRef.current.contains(input)) {
        insertDictationTextToInput(
          input,
          liveTranscript || '',
          finalTranscript || '',
          dictationStateRef.current
        );
      }
    }
  }, [isListening, liveTranscript, finalTranscript, interimTranscript, isSelected]);

  return (
    <Card
      ref={cardRef}
      className={cn(
        'w-full h-full flex flex-col relative group overflow-hidden',
        'min-w-[200px] min-h-[150px]',
        'rounded-lg shadow-md border-none'
      )}
      style={{ backgroundColor: '#ffffff' }} // Fondo blanco para el card, color solo en header
      onClick={() => onEditElement(id)}
    >
      {/* Indicador de estado de guardado */}
      <div className="absolute top-2 right-2 z-10">
        <SaveStatusIndicator status={saveStatus} size="sm" />
      </div>
      {/* HEADER */}
      <CardHeader 
        className="p-2 pb-2 border-b border-gray-200/50"
        style={{ backgroundColor }} // Color solo en el header
      >
        <div className="flex items-center justify-between gap-1">
          {/* Izquierda: Drag Handle + Título */}
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <div className="drag-handle cursor-grab active:cursor-grabbing flex-shrink-0">
              <GripVertical className="h-3 w-3 text-gray-400" />
            </div>
            <Input
              type="text"
              value={title || ''}
              onChange={handleTitleChange}
              className="text-sm font-semibold border-none shadow-none focus-visible:ring-0 p-1 bg-transparent flex-1 min-w-0"
              placeholder="Título..."
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            />
          </div>

          {/* Derecha: Botones de Acción */}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {/* Botón Color */}
            <Popover open={colorPopoverOpen} onOpenChange={setColorPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    setColorPopoverOpen(true);
                  }}
                  title="Cambiar color del header"
                >
                  <Palette className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-auto p-2"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="grid grid-cols-4 gap-1.5">
                  {COLOR_PALETTE.map((color) => (
                    <button
                      key={color.name}
                      className={cn(
                        'w-6 h-6 rounded-full border-2 transition-all hover:scale-110',
                        backgroundColor === color.value ? 'border-gray-800 scale-110' : 'border-gray-300'
                      )}
                      style={{ backgroundColor: color.value }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleColorChange(color.value);
                      }}
                      title={`${color.label} - Aplicar al header`}
                    />
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Menú Más Opciones */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => e.stopPropagation()}
                  title="Más opciones - Copiar, exportar o eliminar lista"
                >
                  <MoreVertical className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()} className="text-sm">
                <DropdownMenuItem onClick={handleCopyAsText} className="text-sm" title="Copia la lista completa al portapapeles en formato texto">
                  <Copy className="mr-2 h-3 w-3" />
                  <span>Copiar lista como texto</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPNG} className="text-sm" title="Exporta la lista como imagen PNG de alta resolución (reducida 30%)">
                  <Download className="mr-2 h-3 w-3" />
                  <span>Exportar a PNG: alta resolución</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleDeleteList}
                  className="text-sm text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-3 w-3" />
                  <span>Eliminar Lista</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      {/* CONTENIDO: Lista de Items */}
      <CardContent className="flex-grow overflow-y-auto p-2">
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId={`droppable-${id}`}>
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-0.5">
                {items.length === 0 ? (
                  <p className="text-xs text-gray-400 italic py-2 text-center">
                    No hay tareas. Agrega una nueva...
                  </p>
                ) : (
                  items.map((item: TodoItem, index: number) => (
                    <Draggable key={item.id} draggableId={item.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={cn(
                            'flex items-center gap-1 p-1 rounded transition-colors group/item',
                            snapshot.isDragging ? 'bg-gray-100 shadow-md' : 'hover:bg-gray-50/50',
                            isSelected && 'hover:bg-gray-50'
                          )}
                        >
                          {/* Drag Handle */}
                          <div
                            {...provided.dragHandleProps}
                            className="cursor-grab active:cursor-grabbing p-0.5 opacity-50 hover:opacity-100 flex-shrink-0"
                          >
                            <GripVertical className="h-3 w-3 text-gray-400" />
                          </div>

                          {/* Checkbox */}
                          <Checkbox
                            checked={item.completed}
                            onCheckedChange={() => handleToggleItem(index)}
                            className="flex-shrink-0 h-3 w-3"
                            onClick={(e) => e.stopPropagation()}
                          />

                          {/* Input de Texto (Compatible con Dictado) - CRÍTICO: Sin onMouseDown para permitir foco */}
                          <input
                            type="text"
                            value={item.text}
                            onChange={(e) => handleItemTextChange(index, e.target.value)}
                            className={cn(
                              'flex-grow text-sm border-none shadow-none focus:outline-none focus:ring-0 p-1 bg-transparent',
                              item.completed ? 'line-through text-gray-500' : 'text-gray-900'
                            )}
                            placeholder="Tarea..."
                            onClick={(e) => e.stopPropagation()}
                            // CRÍTICO: NO usar onMouseDown aquí - permite que el sistema de dictado pueda enfocar el input
                          />

                          {/* Botón Borrar Tarea */}
                          {isSelected && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteItem(index);
                              }}
                              className="h-5 w-5 opacity-0 group-hover/item:opacity-100 hover:opacity-100 transition-opacity flex-shrink-0"
                            >
                              <X className="h-2.5 w-2.5 text-gray-400" />
                            </Button>
                          )}
                        </div>
                      )}
                    </Draggable>
                  ))
                )}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </CardContent>

      {/* FOOTER: Agregar Nueva Tarea */}
      <CardFooter className="p-2 pt-1.5 border-t border-gray-200/50">
        <div className="flex items-center gap-1 w-full">
          <input
            type="text"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddItem();
              }
            }}
            placeholder="Agregar tarea..."
            className="flex-grow text-sm border-none shadow-none focus:outline-none focus:ring-0 p-1 bg-transparent"
            onClick={(e) => e.stopPropagation()}
            // CRÍTICO: NO usar onMouseDown aquí - permite que el sistema de dictado pueda enfocar el input
          />
          <Button
            onClick={(e) => {
              e.stopPropagation();
              handleAddItem();
            }}
            size="sm"
            className="flex-shrink-0 h-6 w-6 p-0"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
