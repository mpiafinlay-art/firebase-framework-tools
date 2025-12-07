'use client';

import React, { useState, useEffect, useMemo, forwardRef } from 'react';
import { Rnd } from 'react-rnd';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  BookCopy,
  RectangleHorizontal,
  StickyNote,
  List,
  Wrench,
  ImageIcon,
  FileText,
  Link,
  Tag,
  MoreHorizontal,
  Mic,
  Move,
  GripVertical,
  Plus,
  Save,
  LogOut,
  Trash2,
  Upload,
  Link as LinkIcon,
  EyeOff,
  FileImage,
  LayoutTemplate,
  MapPin,
  Search,
  Images,
  ChevronDown,
  Timer,
  Clock,
  Highlighter,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ElementType, CanvasElement, Board, WithId, CommentContent, NotepadContent } from '@/lib/types';
import { useAuth } from '@/firebase/provider';
import { signOut } from '@/firebase/auth';
import { useToast } from '@/hooks/use-toast';
import CreateBoardDialog from './create-board-dialog';
import { useMediaQuery } from '@/hooks/use-media-query';

const stickyNoteColors = [
  { name: 'yellow', label: 'Amarillo', className: 'bg-yellow-200' },
  { name: 'pink', label: 'Rosa', className: 'bg-pink-200' },
  { name: 'blue', label: 'Azul', className: 'bg-blue-200' },
  { name: 'green', label: 'Verde', className: 'bg-green-200' },
  { name: 'orange', label: 'Naranja', className: 'bg-orange-200' },
  { name: 'purple', label: 'Morado', className: 'bg-purple-200' },
];

const SidebarButton = forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof Button> & {
    label: string;
    icon?: React.ElementType;
    isActive?: boolean;
  }
>(({ label, icon: Icon, className, isActive, children, ...props }, ref) => {
  // Detectar si es el botón de dictado activo (tiene bg-red-500 en className)
  const isDictationActive = className?.includes('bg-red-500');
  
  return (
    <Button
      ref={ref}
      variant="ghost"
      className={cn(
        'flex flex-col items-center justify-center h-auto py-2 px-2 w-full text-[11px] gap-1',
        'hover:bg-white/20 focus-visible:bg-white/20',
        'text-white border border-white',
        isActive && 'bg-white/30 text-white hover:bg-white/40',
        !isDictationActive && 'text-white',
        className
      )}
      style={{
        backgroundColor: isDictationActive ? undefined : (isActive ? 'rgba(255, 255, 255, 0.3)' : 'transparent'),
        color: isDictationActive ? undefined : '#FFFFFF',
        border: '1px solid #FFFFFF',
      }}
      {...props}
    >
      {children || (Icon && <Icon className={cn('size-[18px]', isDictationActive ? 'text-white' : 'text-white')} style={isDictationActive ? undefined : { color: '#FFFFFF' }} />)}
      <span className={cn('mt-0.5 text-center leading-tight text-[9px]', isDictationActive ? 'text-white' : 'text-white')} style={isDictationActive ? undefined : { color: '#FFFFFF', fontSize: '9px' }}>
        {label}
      </span>
    </Button>
  );
});
SidebarButton.displayName = 'SidebarButton';

// Componente de menú de localizadores con búsqueda
const LocatorsMenu = ({ comments, onLocateElement }: { comments: WithId<CanvasElement>[], onLocateElement: (id: string) => void }) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredComments = useMemo(() => {
    if (!searchTerm) return comments;
    return comments.filter((comment) => {
      const content = comment.content as CommentContent;
      const label = content?.label || content?.title || content?.text || '';
      return label.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [comments, searchTerm]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarButton icon={Tag} label="Localizadores" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start" sideOffset={5} className="w-64">
        {comments.length > 0 ? (
          <>
            <div className="px-2 py-1.5 border-b">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar localizador..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-2 py-1.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {filteredComments.length > 0 ? (
                filteredComments.map((comment) => {
                  const content = comment.content as CommentContent;
                  const label = content?.label || content?.title || content?.text || 'Sin nombre';
                  return (
                    <DropdownMenuItem 
                      key={comment.id} 
                      onClick={() => onLocateElement(comment.id)}
                      className="cursor-pointer"
                    >
                      <MapPin className="mr-2 h-4 w-4" />
                      <span className="truncate">{label}</span>
                    </DropdownMenuItem>
                  );
                })
              ) : (
                <DropdownMenuItem disabled>
                  <span className="text-muted-foreground">No se encontraron localizadores</span>
                </DropdownMenuItem>
              )}
            </div>
          </>
        ) : (
          <DropdownMenuItem disabled>
            <span className="text-muted-foreground">No hay localizadores</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

type ToolsSidebarProps = {
  elements: WithId<CanvasElement>[];
  boards: WithId<Board>[];
  onUploadImage: () => void;
  onAddImageFromUrl: () => void;
  onPanToggle: () => void;
  isListening?: boolean;
  onToggleDictation?: () => void;
  onRenameBoard: () => void;
  onDeleteBoard: () => void;
  onOpenNotepad: (id: string) => void;
  onLocateElement: (id: string) => void;
  addElement: (type: ElementType, props?: any) => Promise<string>;
  clearCanvas: () => void;
  onExportBoardToPng: () => void;
  onFormatToggle: () => void;
  isFormatToolbarOpen: boolean;
  isPanningActive?: boolean;
};

export default function ToolsSidebar(props: ToolsSidebarProps) {
  const {
    elements,
    boards,
    onUploadImage,
    onAddImageFromUrl,
    onPanToggle,
    isListening = false,
    onToggleDictation,
    onRenameBoard,
    onDeleteBoard,
    onOpenNotepad,
    onLocateElement,
    addElement,
    clearCanvas,
    onExportBoardToPng,
    onFormatToggle,
    isFormatToolbarOpen,
    isPanningActive = false,
  } = props;

  const auth = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [isCreateBoardOpen, setIsCreateBoardOpen] = useState(false);
  const [rndPosition, setRndPosition] = useState({ x: 20, y: 80 });

  useEffect(() => {
    try {
      const savedPosition = localStorage.getItem('toolsSidebarPosition');
      if (savedPosition) {
        setRndPosition(JSON.parse(savedPosition));
      }
    } catch (e) {
      console.error('Failed to load sidebar position from localStorage', e);
    }
  }, []);

  const onDragStop = (e: any, d: { x: number; y: number }) => {
    const newPosition = { x: d.x, y: d.y };
    setRndPosition(newPosition);
    try {
      localStorage.setItem('toolsSidebarPosition', JSON.stringify(newPosition));
    } catch (error) {
      console.error('Failed to save sidebar position to localStorage', error);
    }
  };

  const allNotepads = useMemo(
    () => (Array.isArray(elements) ? elements : []).filter((el) => el.type === 'notepad' || el.type === 'notepad-simple' || el.type === 'test-notepad'), // super-notebook desactivado temporalmente
    [elements]
  );

  const notepadsOnCanvas = useMemo(
    () => (Array.isArray(allNotepads) ? allNotepads : []).filter((el) => el.hidden !== true),
    [allNotepads]
  );

  const hiddenNotepads = useMemo(
    () => (Array.isArray(allNotepads) ? allNotepads : []).filter((el) => el.hidden === true),
    [allNotepads]
  );

  const allComments = useMemo(
    () =>
      (Array.isArray(elements) ? elements : []).filter((el) => {
        if (el.type !== 'comment') return false;
        const content = el.content as CommentContent | undefined;
        return !!content && (!!content.title || !!content.label || !!content.text);
      }),
    [elements]
  );

  const handleAddElement = async (type: ElementType, props?: any) => {
    try {
      await addElement(type, props);
      toast({
        title: 'Elemento creado',
        description: `Se ha creado un nuevo ${type}.`,
      });
    } catch (error: any) {
      console.error(`Error al crear elemento ${type}:`, error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || `No se pudo crear el elemento ${type}.`,
      });
    }
  };

  const handleSignOut = async () => {
    if (auth) {
      try {
        await signOut(auth);
        toast({
          title: 'Sesión Cerrada',
          description: 'Has cerrado sesión correctamente.',
        });
        router.push('/?logout=true');
      } catch (error) {
        console.error('Error al cerrar sesión:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'No se pudo cerrar la sesión.',
        });
      }
    }
  };

  return (
    <>
      <CreateBoardDialog isOpen={isCreateBoardOpen} onOpenChange={setIsCreateBoardOpen} />
      <Rnd
        default={{
          x: rndPosition.x,
          y: rndPosition.y,
          width: 144,
          height: 'auto',
        }}
        minWidth={144}
        maxWidth={144}
        bounds="window"
        dragHandleClassName="drag-handle"
        onDragStop={onDragStop}
        className="z-[10001]"
      >
        <div 
          className="rounded-lg shadow-lg border border-white/30 p-2 flex flex-col gap-1"
          style={{ backgroundColor: '#0b8384' }}
        >
          <div className="drag-handle cursor-grab active:cursor-grabbing py-1 flex justify-center">
            <GripVertical className="size-5" style={{ color: '#FFFFFF' }} />
          </div>
          <div className="grid grid-cols-2 gap-1">

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarButton icon={LayoutDashboard} label="Tableros" />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" sideOffset={5}>
              <DropdownMenuItem onClick={() => setIsCreateBoardOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                <span>Nuevo Tablero</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDeleteBoard} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                <span>Eliminar Tablero</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {boards.length > 0 && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <span>Abrir Tablero...</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {boards.map((board) => (
                      <DropdownMenuItem key={board.id} onClick={() => router.push(`/board/${board.id}`)}>
                        <span>{board.name || 'Sin nombre'}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <SidebarButton
            icon={Trash2}
            label="Borrar Tablero"
            onClick={onDeleteBoard}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          />

          <SidebarButton
            icon={Mic}
            label={isListening ? 'Detener' : 'Dictar'}
            onClick={onToggleDictation}
            onMouseDown={(e) => e.preventDefault()}
            className={cn(
              isListening && 'bg-red-500 text-white hover:bg-red-600 animate-pulse'
            )}
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarButton icon={BookCopy} label="Cuadernos" />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" sideOffset={5}>
              <DropdownMenuItem onClick={() => handleAddElement('notepad')}>
                <Plus className="mr-2 h-4 w-4" />
                <span>Agregar notepad</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAddElement('yellow-notepad')}>
                <Plus className="mr-2 h-4 w-4" />
                <span>Nuevo Notepad Yellow</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onLocateElement('rzBhqCTd8wwZmD8JCNEk')}>
                <Plus className="mr-2 h-4 w-4" />
                <span>Nuevo Block de Notas</span>
              </DropdownMenuItem>
              {notepadsOnCanvas.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <span>Cuadernos Abiertos ({notepadsOnCanvas.length})</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {notepadsOnCanvas.map((notepad) => {
                        const content = notepad.content as NotepadContent;
                        const title = content?.title || 'Sin título';
                        return (
                          <DropdownMenuItem key={notepad.id} onClick={() => onLocateElement(notepad.id)}>
                            <span>{title}</span>
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </>
              )}
              {hiddenNotepads.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <span>Cerrados ({hiddenNotepads.length})</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {hiddenNotepads.map((notepad) => {
                        const content = notepad.content as NotepadContent;
                        const title = content?.title || 'Sin título';
                        return (
                          <DropdownMenuItem key={notepad.id} onClick={() => onOpenNotepad(notepad.id)}>
                            <EyeOff className="mr-2 h-4 w-4" />
                            <span>{title}</span>
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarButton icon={StickyNote} label="Notas" />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" sideOffset={5}>
              {stickyNoteColors.map((color) => (
                <DropdownMenuItem key={color.name} onClick={() => handleAddElement('sticky', { color: color.name })}>
                  <div className={cn('w-4 h-4 rounded-sm mr-2 border border-slate-300', color.className)} />
                  <span className="capitalize">{color.label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <SidebarButton icon={List} label="To-do" onClick={() => handleAddElement('todo')} />

          <SidebarButton icon={Wrench} label="Tools" onClick={onFormatToggle} isActive={isFormatToolbarOpen} />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarButton icon={ImageIcon} label="Imagen" />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" sideOffset={5}>
              <DropdownMenuItem onClick={onAddImageFromUrl}>
                <LinkIcon className="mr-2 h-4 w-4" />
                <span>Desde URL</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onUploadImage}>
                <Upload className="mr-2 h-4 w-4" />
                <span>Subir</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <SidebarButton 
            icon={Images} 
            label="Moodboard" 
            onClick={() => handleAddElement('moodboard')} 
          />

          <SidebarButton 
            icon={FileText} 
            label="Bloc Tabs" 
            onClick={() => handleAddElement('tabbed-notepad')} 
          />

          <Popover>
            <PopoverTrigger asChild>
              <SidebarButton icon={FileText} label="Texto" />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2">
              <div className="text-xs text-gray-600 mb-2">Color de fondo</div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { name: 'white', value: '#ffffff', label: 'Blanco' },
                  { name: 'yellow', value: '#fffb8b', label: 'Amarillo' },
                  { name: 'pink', value: '#ffc2d4', label: 'Rosa' },
                  { name: 'blue', value: '#bce8f1', label: 'Azul' },
                  { name: 'green', value: '#d4edda', label: 'Verde' },
                  { name: 'orange', value: '#ffeeba', label: 'Naranja' },
                  { name: 'purple', value: '#e9d5ff', label: 'Morado' },
                ].map((color) => (
                  <button
                    key={color.name}
                    className="w-8 h-8 rounded border border-gray-300 hover:scale-110 transition-transform"
                    style={{ backgroundColor: color.value }}
                    onClick={() => handleAddElement('text', {
                      properties: {
                        backgroundColor: color.value
                      }
                    })}
                    title={color.label}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <SidebarButton 
            icon={ChevronDown} 
            label="Acordeón" 
            onClick={() => handleAddElement('accordion', {
              content: { items: [{ id: '1', title: 'Nuevo Item', content: '' }] },
              properties: {
                position: { x: 200, y: 100 },
                size: { width: 320, height: 240 },
              }
            })} 
          />

          <LocatorsMenu 
            comments={allComments}
            onLocateElement={onLocateElement}
          />

          <SidebarButton 
            icon={Timer} 
            label="Cronómetro" 
            onClick={() => handleAddElement('stopwatch')} 
          />

          <SidebarButton 
            icon={Clock} 
            label="Temporizador" 
            onClick={() => handleAddElement('countdown')} 
          />

          <SidebarButton 
            icon={Highlighter} 
            label="Destacador" 
            onClick={() => handleAddElement('highlight-text')} 
          />

          <SidebarButton icon={FileImage} label="Exportar Tablero" onClick={onExportBoardToPng} />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarButton icon={MoreHorizontal} label="Más" />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" sideOffset={5}>
              <DropdownMenuItem onClick={onFormatToggle}>
                <Wrench className="mr-2 h-4 w-4" />
                <span>Formato de Texto</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onExportBoardToPng}>
                <FileImage className="mr-2 h-4 w-4" />
                <span>Exportar a PNG: alta resolución</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span>Eliminar Tablero</span>
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción eliminará permanentemente este tablero y todo su contenido. Esta acción no se puede deshacer.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onDeleteBoard}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Sí, eliminar tablero
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span>Limpiar Tablero</span>
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción eliminará todos los elementos del tablero. Esta acción no se puede deshacer.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={clearCanvas}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Sí, limpiar tablero
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Cerrar Sesión</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>
      </Rnd>
    </>
  );
}
