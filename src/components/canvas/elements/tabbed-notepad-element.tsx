'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import type { CommonElementProps, TabbedNotepadContent, TabbedNotepadTab } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GripVertical, X, Plus, Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAutoSave } from '@/hooks/use-auto-save';
import { SaveStatusIndicator } from '@/components/canvas/save-status-indicator';
import { useToast } from '@/hooks/use-toast';
import html2canvas from 'html2canvas';
import { useDictationInput } from '@/hooks/use-dictation-input';

// Type guard para TabbedNotepadContent
function isTabbedNotepadContent(content: unknown): content is TabbedNotepadContent {
  return typeof content === 'object' && content !== null && 'tabs' in content;
}

export default function TabbedNotepadElement(props: CommonElementProps) {
  const {
    id,
    properties,
    isSelected,
    onSelectElement,
    onEditElement,
    content,
    onUpdate,
    deleteElement,
    isListening,
    liveTranscript,
    finalTranscript,
    interimTranscript,
  } = props;

  const { toast } = useToast();
  const safeProperties = typeof properties === 'object' && properties !== null ? properties : {};
  const tabbedContent: TabbedNotepadContent = isTabbedNotepadContent(content)
    ? content
    : { title: 'Bloc de Notas', tabs: [{ id: 'tab-1', title: 'Pestaña 1', content: '' }], activeTabId: 'tab-1' };

  const [isExporting, setIsExporting] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRefs = useRef<{ [key: string]: HTMLTextAreaElement | null }>({});
  // Estado local para preservar el cursor en textareas
  const [localTabContent, setLocalTabContent] = useState<{ [key: string]: string }>({});

  const activeTabId = tabbedContent.activeTabId || tabbedContent.tabs[0]?.id || 'tab-1';
  const activeTab = tabbedContent.tabs.find((tab: TabbedNotepadTab) => tab.id === activeTabId) || tabbedContent.tabs[0];

  // Hook de autoguardado para el título
  const { saveStatus: titleSaveStatus, handleBlur: handleTitleBlur, handleChange: handleTitleChange } = useAutoSave({
    getContent: () => titleInputRef.current?.value || tabbedContent.title || '',
    onSave: async (newTitle) => {
      if (newTitle !== tabbedContent.title) {
        onUpdate(id, { content: { ...tabbedContent, title: newTitle } });
      }
    },
    debounceMs: 1000,
  });

  // Agregar nueva pestaña
  const handleAddTab = useCallback(() => {
    const newTab: TabbedNotepadTab = {
      id: `tab-${Date.now()}`,
      title: `Pestaña ${tabbedContent.tabs.length + 1}`,
      content: '',
    };
    const updatedContent: TabbedNotepadContent = {
      ...tabbedContent,
      tabs: [...tabbedContent.tabs, newTab],
      activeTabId: newTab.id,
    };
    onUpdate(id, { content: updatedContent });
  }, [id, tabbedContent, onUpdate]);

  // Eliminar pestaña
  const handleRemoveTab = useCallback((tabId: string) => {
    if (tabbedContent.tabs.length <= 1) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Debe haber al menos una pestaña.',
      });
      return;
    }
    
    const updatedTabs = tabbedContent.tabs.filter((tab: TabbedNotepadTab) => tab.id !== tabId);
    const newActiveTabId = tabId === activeTabId 
      ? (updatedTabs[0]?.id || 'tab-1')
      : activeTabId;
    
    const updatedContent: TabbedNotepadContent = {
      ...tabbedContent,
      tabs: updatedTabs,
      activeTabId: newActiveTabId,
    };
    onUpdate(id, { content: updatedContent });
  }, [id, tabbedContent, activeTabId, onUpdate, toast]);

  // Cambiar pestaña activa
  const handleTabChange = useCallback((tabId: string) => {
    const updatedContent: TabbedNotepadContent = {
      ...tabbedContent,
      activeTabId: tabId,
    };
    onUpdate(id, { content: updatedContent });
  }, [id, tabbedContent, onUpdate]);

  // Actualizar título de pestaña
  const handleTabTitleChange = useCallback((tabId: string, newTitle: string) => {
    const updatedContent: TabbedNotepadContent = {
      ...tabbedContent,
      tabs: tabbedContent.tabs.map((tab: TabbedNotepadTab) =>
        tab.id === tabId ? { ...tab, title: newTitle } : tab
      ),
    };
    onUpdate(id, { content: updatedContent });
  }, [id, tabbedContent, onUpdate]);

  // Actualizar contenido de pestaña
  const handleTabContentChange = useCallback((tabId: string, newContent: string) => {
    // Actualizar estado local inmediatamente
    setLocalTabContent(prev => ({ ...prev, [tabId]: newContent }));
    
    const updatedContent: TabbedNotepadContent = {
      ...tabbedContent,
      tabs: tabbedContent.tabs.map((tab: TabbedNotepadTab) =>
        tab.id === tabId ? { ...tab, content: newContent } : tab
      ),
    };
    onUpdate(id, { content: updatedContent });
  }, [id, tabbedContent, onUpdate]);
  
  // Sincronizar estado local con props cuando cambia el contenido externo
  useEffect(() => {
    const newLocalContent: { [key: string]: string } = {};
    tabbedContent.tabs.forEach((tab: TabbedNotepadTab) => {
      const textarea = textareaRefs.current[tab.id];
      // Solo actualizar si el textarea NO está enfocado (para preservar cursor)
      if (textarea && document.activeElement !== textarea) {
        // Solo actualizar si el contenido cambió externamente (no desde onChange)
        const currentLocal = localTabContent[tab.id];
        if (currentLocal !== tab.content) {
          newLocalContent[tab.id] = tab.content;
        } else {
          newLocalContent[tab.id] = currentLocal ?? tab.content;
        }
      } else {
        // Mantener el valor local si está enfocado
        newLocalContent[tab.id] = localTabContent[tab.id] ?? tab.content;
      }
    });
    // Solo actualizar si hay cambios
    const hasChanges = Object.keys(newLocalContent).some(
      key => newLocalContent[key] !== localTabContent[key]
    );
    if (hasChanges || Object.keys(localTabContent).length === 0) {
      setLocalTabContent(newLocalContent);
    }
  }, [
    // Dependencia estable: crear string único basado en contenido para evitar re-renders innecesarios
    tabbedContent.tabs.map(t => `${t.id}|${t.content}`).join('||'),
    tabbedContent.tabs.length
  ]);

  // Exportar a PNG
  const handleExportToPng = useCallback(async () => {
    if (!containerRef.current) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo encontrar el elemento para exportar.',
      });
      return;
    }

    setIsExporting(true);
    toast({
      title: 'Exportando...',
      description: 'Generando imagen PNG de alta resolución.',
    });

    try {
      const canvas = await html2canvas(containerRef.current, {
        backgroundColor: '#ffffff',
        scale: 3,
        useCORS: true,
        logging: false,
        allowTaint: false,
        windowWidth: containerRef.current.scrollWidth,
        windowHeight: containerRef.current.scrollHeight,
      });

      canvas.toBlob((blob: Blob | null) => {
        if (!blob) {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: 'No se pudo generar la imagen.',
          });
          setIsExporting(false);
          return;
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const title = tabbedContent.title || 'bloc-notas';
        link.download = `${title}_${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast({
          title: 'Exportado',
          description: 'El bloc de notas se ha exportado como PNG de alta resolución.',
        });
        setIsExporting(false);
      }, 'image/png', 1.0);
    } catch (error: any) {
      console.error('Error al exportar:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Ocurrió un error al exportar.',
      });
      setIsExporting(false);
    }
  }, [tabbedContent.title, toast]);

  // Cerrar elemento
  const handleClose = useCallback(() => {
    onUpdate(id, { hidden: true });
  }, [id, onUpdate]);

  // Soporte para dictado usando hook helper
  // NOTA: Este elemento tiene múltiples textareas, el hook detectará el activo
  const activeTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  
  // Actualizar ref cuando cambia el textarea activo
  useEffect(() => {
    const activeElement = document.activeElement;
    if (activeElement && activeElement.tagName === 'TEXTAREA') {
      const textarea = activeElement as HTMLTextAreaElement;
      if (containerRef.current && containerRef.current.contains(textarea)) {
        activeTextareaRef.current = textarea;
      }
    }
  }, [activeTab]);

  // Aplicar dictado al textarea activo
  useDictationInput({
    elementRef: activeTextareaRef as React.RefObject<HTMLTextAreaElement>,
    isListening: isListening || false,
    liveTranscript: liveTranscript || '',
    finalTranscript: finalTranscript || '',
    interimTranscript: interimTranscript || '',
    isSelected: isSelected || false,
    enabled: true,
  });

  // Actualizar contenido de pestaña cuando cambia el valor del textarea
  useEffect(() => {
    if (activeTextareaRef.current && activeTab) {
      const textarea = activeTextareaRef.current;
      const handleInput = () => {
        handleTabContentChange(activeTab.id, textarea.value);
      };
      textarea.addEventListener('input', handleInput);
      return () => textarea.removeEventListener('input', handleInput);
    }
  }, [activeTab, handleTabContentChange]);

  const backgroundColor = safeProperties?.backgroundColor || '#ffffff';

  return (
    <Card
      id={id}
      data-element-type="tabbed-notepad"
      data-element-id={id}
      ref={containerRef}
      className={cn(
        'w-full h-full flex flex-col overflow-hidden',
        'min-w-[400px] min-h-[300px]',
        'rounded-lg shadow-lg border border-gray-200/50',
        isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : '',
        'hover:shadow-xl transition-shadow'
      )}
      style={{
        backgroundColor: backgroundColor === 'transparent' ? '#ffffff' : backgroundColor,
        pointerEvents: 'auto',
      }}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest('.drag-handle')) {
          onEditElement(id);
        }
      }}
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).closest('.drag-handle')) {
          return;
        }
        e.stopPropagation();
        onSelectElement(id, false);
      }}
    >
      {/* HEADER */}
      <CardHeader className="p-3 border-b border-gray-200 bg-white flex flex-row items-center justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="drag-handle cursor-grab active:cursor-grabbing flex-shrink-0">
            <GripVertical className="h-4 w-4 text-gray-400" />
          </div>
          <input
            ref={titleInputRef}
            type="text"
            value={tabbedContent.title || ''}
            onChange={(e) => {
              handleTitleChange();
              const newContent: TabbedNotepadContent = { ...tabbedContent, title: e.target.value };
              onUpdate(id, { content: newContent });
            }}
            onBlur={handleTitleBlur}
            className="flex-1 min-w-0 text-sm font-semibold bg-transparent border-none outline-none focus:outline-none focus:ring-0 p-1"
            placeholder="Título del bloc..."
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          />
        </div>
        
        <div className="flex items-center gap-1 flex-shrink-0">
          <SaveStatusIndicator status={titleSaveStatus} size="sm" />
          
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Exportar a PNG"
            onClick={(e) => {
              e.stopPropagation();
              handleExportToPng();
            }}
            disabled={isExporting}
          >
            <Download className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-gray-400 hover:text-gray-600"
            title="Cerrar bloc"
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      {/* CONTENT */}
      <CardContent className="flex-1 p-3 overflow-hidden flex flex-col" style={{ minHeight: 0 }}>
        <Tabs value={activeTabId} onValueChange={handleTabChange} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <TabsList className="flex-1 justify-start overflow-x-auto">
              {tabbedContent.tabs.map((tab: TabbedNotepadTab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="relative group/tab"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="text"
                    value={tab.title}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleTabTitleChange(tab.id, e.target.value);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="bg-transparent border-none outline-none text-xs px-1 min-w-[60px] max-w-[120px]"
                  />
                  {tabbedContent.tabs.length > 1 && (
                    <span
                      className="inline-flex items-center justify-center h-4 w-4 ml-1 opacity-0 group-hover/tab:opacity-100 transition-opacity cursor-pointer hover:bg-gray-100 rounded"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleRemoveTab(tab.id);
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          handleRemoveTab(tab.id);
                        }
                      }}
                    >
                      <X className="h-3 w-3" />
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
            
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 ml-2"
              title="Agregar pestaña"
              onClick={(e) => {
                e.stopPropagation();
                handleAddTab();
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {tabbedContent.tabs.map((tab) => {
            // Usar estado local si existe, sino usar el valor del prop
            const textareaValue = localTabContent[tab.id] !== undefined 
              ? localTabContent[tab.id] 
              : tab.content;
            
            return (
              <TabsContent
                key={tab.id}
                value={tab.id}
                className="flex-1 overflow-hidden mt-0"
              >
                <textarea
                  ref={(el) => {
                    textareaRefs.current[tab.id] = el;
                    // Inicializar estado local si no existe
                    if (el && localTabContent[tab.id] === undefined) {
                      setLocalTabContent(prev => ({ ...prev, [tab.id]: tab.content }));
                    }
                  }}
                  value={textareaValue}
                  onChange={(e) => {
                    handleTabContentChange(tab.id, e.target.value);
                  }}
                  className="w-full h-full resize-none border-none outline-none bg-transparent p-2 text-sm"
                  placeholder="Escribe aquí..."
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  style={{ minHeight: '200px' }}
                />
              </TabsContent>
            );
          })}
        </Tabs>
      </CardContent>
    </Card>
  );
}
