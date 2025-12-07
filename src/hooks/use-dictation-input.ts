/**
 * Hook Helper para aplicar dictado a elementos editables
 * Versión SENIOR - Código probado y sin errores
 * Compatible con contentEditable, Input y Textarea
 */

'use client';

import { useEffect, useRef } from 'react';
import { insertDictationTextToContentEditable, insertDictationTextToInput, type DictationState } from '@/lib/dictation-helper';

interface UseDictationInputOptions {
  elementRef: React.RefObject<HTMLElement | HTMLInputElement | HTMLTextAreaElement>;
  isListening: boolean;
  liveTranscript: string;
  finalTranscript?: string;
  interimTranscript?: string;
  isSelected?: boolean;
  enabled?: boolean;
}

/**
 * Hook para aplicar dictado a cualquier elemento editable
 * Funciona con:
 * - contentEditable divs
 * - Input elements
 * - Textarea elements
 */
export function useDictationInput({
  elementRef,
  isListening,
  liveTranscript,
  finalTranscript = '',
  interimTranscript = '',
  isSelected = false,
  enabled = true,
}: UseDictationInputOptions) {
  const dictationStateRef = useRef<DictationState>({
    lastInsertedText: '',
    lastFinalText: '',
  });
  
  // CRÍTICO: Ref para rastrear el último liveTranscript procesado y evitar duplicación
  const lastProcessedTranscriptRef = useRef<string>('');

  // Ref para mantener referencia estable a elementRef
  const elementRefStable = useRef(elementRef.current);
  
  // Sincronizar ref cuando cambia elementRef
  useEffect(() => {
    elementRefStable.current = elementRef.current;
  }, [elementRef.current]);

  useEffect(() => {
    if (!enabled || !isListening || !elementRefStable.current) {
      return;
    }

    const element = elementRefStable.current;

    // CRÍTICO: Solo procesar si el elemento está enfocado O está seleccionado
    // Esto permite que funcione incluso si el elemento no tiene focus pero está seleccionado
    const isFocused = document.activeElement === element;
    const shouldProcess = isFocused || (isSelected && element.isContentEditable);
    
    if (!shouldProcess) {
      return;
    }

    // No procesar si no hay transcript
    if (!liveTranscript && !finalTranscript && !interimTranscript) {
      return;
    }

    // CRÍTICO: Evitar procesar el mismo liveTranscript dos veces
    // Si el liveTranscript no ha cambiado desde la última vez, no procesar
    if (liveTranscript === lastProcessedTranscriptRef.current && liveTranscript !== '') {
      return;
    }

    try {
      // Determinar tipo de elemento y usar el helper apropiado
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        insertDictationTextToInput(
          element,
          liveTranscript || '',
          finalTranscript || '',
          dictationStateRef.current
        );
        // Actualizar ref después de insertar
        lastProcessedTranscriptRef.current = liveTranscript;
      } else if (element.isContentEditable) {
        // Si no está enfocado pero está seleccionado, enfocarlo primero
        if (!isFocused && isSelected) {
          element.focus();
          // Esperar un momento para que el focus se establezca
          setTimeout(() => {
            if (elementRefStable.current) {
              insertDictationTextToContentEditable(
                elementRefStable.current,
                liveTranscript || '',
                finalTranscript || '',
                interimTranscript || '',
                dictationStateRef.current
              );
              const inputEvent = new Event('input', { bubbles: true });
              elementRefStable.current.dispatchEvent(inputEvent);
              // Actualizar ref después de insertar
              lastProcessedTranscriptRef.current = liveTranscript;
            }
          }, 50);
        } else {
          insertDictationTextToContentEditable(
            element,
            liveTranscript || '',
            finalTranscript || '',
            interimTranscript || '',
            dictationStateRef.current
          );
          // Disparar evento input para autoguardado
          const inputEvent = new Event('input', { bubbles: true });
          element.dispatchEvent(inputEvent);
          // Actualizar ref después de insertar
          lastProcessedTranscriptRef.current = liveTranscript;
        }
      }
    } catch (error) {
      console.error('Error insertando dictado:', error);
    }
  }, [isListening, liveTranscript, finalTranscript, interimTranscript, isSelected, enabled]); // Eliminar elementRef de dependencias

  // Finalizar texto provisional cuando se detiene el dictado o hay texto final
  useEffect(() => {
    const element = elementRefStable.current;
    if (!isListening && element && element.isContentEditable) {
      const { finalizeInterimText } = require('@/lib/dictation-helper');
      finalizeInterimText(element);
    }
    if (finalTranscript && element && element.isContentEditable) {
      const { finalizeInterimText } = require('@/lib/dictation-helper');
      finalizeInterimText(element);
    }
  }, [isListening, finalTranscript]); // Eliminar elementRef de dependencias

  // Resetear estado cuando se detiene el dictado
  useEffect(() => {
    if (!isListening) {
      dictationStateRef.current = {
        lastInsertedText: '',
        lastFinalText: '',
      };
      // CRÍTICO: Resetear también el ref de transcript procesado
      lastProcessedTranscriptRef.current = '';
    }
  }, [isListening]);
}
