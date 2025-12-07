'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseAutoSaveOptions {
  /**
   * Función que obtiene el contenido actual del elemento
   * Debe retornar el contenido que se va a guardar
   */
  getContent: () => any;
  
  /**
   * Función que guarda el contenido
   * Recibe el contenido a guardar
   */
  onSave: (content: any) => void | Promise<void>;
  
  /**
   * Delay en milisegundos para el debounce del auto-save
   * Por defecto: 2000ms (2 segundos)
   */
  debounceMs?: number;
  
  /**
   * Si es true, deshabilita el auto-save (solo guarda en onBlur)
   * Por defecto: false
   */
  disabled?: boolean;
  
  /**
   * Comparador personalizado para determinar si el contenido cambió
   * Por defecto: compara con ===
   */
  compareContent?: (oldContent: any, newContent: any) => boolean;
}

interface UseAutoSaveReturn {
  /**
   * Estado actual del guardado
   */
  saveStatus: SaveStatus;
  
  /**
   * Función para forzar guardado inmediato
   */
  forceSave: () => Promise<void>;
  
  /**
   * Handler para onBlur - guarda inmediatamente
   */
  handleBlur: () => Promise<void>;
  
  /**
   * Handler para onChange - programa auto-save con debounce
   */
  handleChange: () => void;
  
  /**
   * Limpia el timeout pendiente (útil para cleanup)
   */
  cancelPendingSave: () => void;
}

/**
 * Hook para autoguardado robusto con:
 * - Auto-save con debounce (2 segundos por defecto)
 * - Guardado inmediato en onBlur
 * - Feedback visual del estado de guardado
 * - Prevención de stale closures
 * 
 * @example
 * const { saveStatus, handleBlur, handleChange } = useAutoSave({
 *   getContent: () => editorRef.current?.innerHTML || '',
 *   onSave: (content) => onUpdate(id, { content }),
 *   debounceMs: 2000,
 * });
 */
export function useAutoSave({
  getContent,
  onSave,
  debounceMs = 2000,
  disabled = false,
  compareContent,
}: UseAutoSaveOptions): UseAutoSaveReturn {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedContentRef = useRef<any>(null);
  const isSavingRef = useRef(false);
  const saveStatusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Comparador de contenido por defecto
  const defaultCompareContent = useCallback((oldContent: any, newContent: any) => {
    return oldContent === newContent;
  }, []);

  const compare = compareContent || defaultCompareContent;

  // Limpiar timeouts al desmontar
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (saveStatusTimeoutRef.current) {
        clearTimeout(saveStatusTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Función interna para guardar el contenido
   * Previene múltiples guardados simultáneos y guardados infinitos
   */
  const performSave = useCallback(async () => {
    // Si ya está guardando, esperar a que termine
    if (isSavingRef.current) {
      return;
    }

    try {
      isSavingRef.current = true;
      const currentContent = getContent();
      
      // CRÍTICO: Normalizar contenido para comparación (especialmente HTML)
      const normalizeContent = (content: any): any => {
        if (typeof content === 'string') {
          // Normalizar HTML: remover espacios extra, normalizar comillas, etc.
          return content
            .replace(/\s+/g, ' ')
            .replace(/>\s+</g, '><')
            .trim();
        }
        if (typeof content === 'object' && content !== null) {
          // Para objetos, serializar y normalizar
          try {
            return JSON.stringify(content);
          } catch {
            return content;
          }
        }
        return content;
      };
      
      const normalizedCurrent = normalizeContent(currentContent);
      const normalizedLast = lastSavedContentRef.current !== null 
        ? normalizeContent(lastSavedContentRef.current) 
        : null;
      
      // Verificar si el contenido realmente cambió
      if (normalizedLast !== null && normalizedCurrent === normalizedLast) {
        isSavingRef.current = false;
        return;
      }

      setSaveStatus('saving');
      
      // Ejecutar el guardado
      await onSave(currentContent);
      
      // Actualizar referencia del último contenido guardado (guardar el original, no el normalizado)
      lastSavedContentRef.current = currentContent;
      
      // Mostrar estado "guardado" por 2 segundos
      setSaveStatus('saved');
      
      // Limpiar timeout anterior si existe
      if (saveStatusTimeoutRef.current) {
        clearTimeout(saveStatusTimeoutRef.current);
      }
      
      // Volver a "idle" después de 2 segundos
      saveStatusTimeoutRef.current = setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
      
    } catch (error) {
      console.error('Error al guardar:', error);
      setSaveStatus('error');
      
      // Volver a "idle" después de 3 segundos en caso de error
      if (saveStatusTimeoutRef.current) {
        clearTimeout(saveStatusTimeoutRef.current);
      }
      saveStatusTimeoutRef.current = setTimeout(() => {
        setSaveStatus('idle');
      }, 3000);
    } finally {
      isSavingRef.current = false;
    }
  }, [getContent, onSave, compare]);

  /**
   * Cancela el guardado pendiente programado
   */
  const cancelPendingSave = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
  }, []);

  /**
   * Fuerza un guardado inmediato (sin debounce)
   */
  const forceSave = useCallback(async () => {
    cancelPendingSave();
    await performSave();
  }, [cancelPendingSave, performSave]);

  /**
   * Handler para onBlur - guarda inmediatamente
   */
  const handleBlur = useCallback(async () => {
    cancelPendingSave();
    await performSave();
  }, [cancelPendingSave, performSave]);

  /**
   * Handler para onChange - programa auto-save con debounce
   */
  const handleChange = useCallback(() => {
    if (disabled) return;
    
    // Cancelar guardado anterior si existe
    cancelPendingSave();
    
    // Programar nuevo guardado con debounce
    debounceTimeoutRef.current = setTimeout(() => {
      performSave();
    }, debounceMs);
  }, [disabled, cancelPendingSave, performSave, debounceMs]);

  return {
    saveStatus,
    forceSave,
    handleBlur,
    handleChange,
    cancelPendingSave,
  };
}

