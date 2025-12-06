/**
 * Hook de Dictado - Versión Simplificada según Readme 18 Nov
 * Implementación simple y directa: clic en Mic -> hablar -> clic en Mic para detener
 * Compatible con React y Firebase
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { formatFinalText, formatInterimText } from '@/lib/text-processor';

interface UseDictationReturn {
  isSupported: boolean;
  isListening: boolean;
  transcript: string;
  finalTranscript: string;
  interimTranscript: string;
  permissionError: string | null;
  start: () => Promise<void>;
  stop: () => void;
  toggle: () => Promise<void>;
  resetTranscript: () => void;
}

// Verificar soporte del navegador
const getSpeechRecognition = (): typeof SpeechRecognition | null => {
  if (typeof window === 'undefined') return null;
  
  const SpeechRecognition = 
    (window as any).SpeechRecognition || 
    (window as any).webkitSpeechRecognition;
  
  return SpeechRecognition || null;
};

export const useDictation = (): UseDictationReturn => {
  const [isListening, setIsListening] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const accumulatedFinalRef = useRef<string>('');
  const isManualStopRef = useRef<boolean>(false);
  // CRÍTICO: Refs para leer valores actuales sin causar re-renders
  const isListeningRef = useRef<boolean>(false);
  const permissionErrorRef = useRef<string | null>(null);

  // Sincronizar refs con state
  useEffect(() => {
    isListeningRef.current = isListening;
    permissionErrorRef.current = permissionError;
  }, [isListening, permissionError]);

  // Inicializar reconocimiento de voz (SOLO UNA VEZ)
  useEffect(() => {
    const SpeechRecognition = getSpeechRecognition();
    
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);
    
    // Crear instancia de reconocimiento
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'es-MX'; // Español latinoamericano

    // Evento: Inicio de reconocimiento
    recognition.onstart = () => {
      console.log('🎤 Dictado iniciado');
      isManualStopRef.current = false;
      isListeningRef.current = true;
      setIsListening(true);
      setPermissionError(null);
      permissionErrorRef.current = null;
    };

    // Evento: Resultados del reconocimiento
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }

      // Procesar texto final
      if (final) {
        const processed = formatFinalText(final);
        accumulatedFinalRef.current += (accumulatedFinalRef.current ? ' ' : '') + processed;
        setFinalTranscript(accumulatedFinalRef.current);
      }

      // Procesar texto provisional
      if (interim) {
        const processed = formatInterimText(interim);
        setInterimTranscript(processed);
      }
    };

    // Evento: Error en reconocimiento
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Error en reconocimiento de voz:', event.error);
      
      // Errores no críticos: ignorar
      if (event.error === 'no-speech' || event.error === 'aborted') {
        return;
      }

      // Error de permisos
      if (event.error === 'not-allowed') {
        isListeningRef.current = false;
        setIsListening(false);
        isManualStopRef.current = false;
        const errorMsg = 'Permiso de micrófono denegado. Por favor, permite el acceso al micrófono en la configuración de tu navegador.';
        setPermissionError(errorMsg);
        permissionErrorRef.current = errorMsg;
        return;
      }

      // Otros errores críticos
      if (event.error === 'network') {
        isListeningRef.current = false;
        setIsListening(false);
        isManualStopRef.current = false;
        const errorMsg = 'Error de red. Verifica tu conexión a internet.';
        setPermissionError(errorMsg);
        permissionErrorRef.current = errorMsg;
        return;
      }

      if (event.error === 'audio-capture') {
        isListeningRef.current = false;
        setIsListening(false);
        const errorMsg = 'No se detectó ningún micrófono. Verifica que tu micrófono esté conectado y funcionando.';
        setPermissionError(errorMsg);
        permissionErrorRef.current = errorMsg;
        return;
      }
    };

    // Evento: Fin de reconocimiento
    recognition.onend = () => {
      console.log('🎤 Dictado finalizado');
      
      // Si fue detenido manualmente, no reiniciar
      if (isManualStopRef.current) {
        isListeningRef.current = false;
        setIsListening(false);
        return;
      }
      
      // Reiniciar automáticamente si no fue detenido manualmente (escucha continua)
      // CRÍTICO: Usar refs para leer valores actuales sin causar re-renders
      if (isListeningRef.current && !permissionErrorRef.current) {
        setTimeout(() => {
          if (!isManualStopRef.current && recognitionRef.current && isListeningRef.current && !permissionErrorRef.current) {
            try {
              recognitionRef.current.start();
            } catch (error) {
              console.error('Error al reiniciar reconocimiento:', error);
              isListeningRef.current = false;
              setIsListening(false);
            }
          }
        }, 100);
      } else {
        isListeningRef.current = false;
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    // Limpieza
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (error) {
          // Ignorar errores al limpiar
        }
        recognitionRef.current = null;
      }
    };
  }, []); // CRÍTICO: Sin dependencias - solo inicializar una vez

  // Función para iniciar reconocimiento
  const start = useCallback(async () => {
    if (!isSupported || !recognitionRef.current) {
      console.warn('Reconocimiento de voz no disponible');
      return;
    }

    if (isListening) {
      console.warn('Ya está escuchando');
      return;
    }

    try {
      // Resetear flags y estado
      isManualStopRef.current = false;
      accumulatedFinalRef.current = '';
      setFinalTranscript('');
      setInterimTranscript('');
      setPermissionError(null);
      
      // Iniciar reconocimiento
      recognitionRef.current.start();
    } catch (error: any) {
      console.error('Error al iniciar reconocimiento:', error);
      
      // Manejar error de permisos
      if (error.name === 'NotAllowedError' || error.message?.includes('not-allowed')) {
        setPermissionError('Permiso de micrófono denegado. Por favor, permite el acceso al micrófono en la configuración de tu navegador.');
        setIsListening(false);
        return;
      }
      
      // Si el error es que ya está corriendo, intentar detener y reiniciar
      if (error.message?.includes('already started') || error.name === 'InvalidStateError') {
        try {
          recognitionRef.current?.stop();
          setTimeout(() => {
            if (recognitionRef.current) {
              recognitionRef.current.start();
            }
          }, 100);
        } catch (retryError) {
          console.error('Error al reiniciar:', retryError);
          setIsListening(false);
        }
      } else {
        setIsListening(false);
      }
    }
  }, [isSupported, isListening]);

  // Función para detener reconocimiento
  const stop = useCallback(() => {
    if (!recognitionRef.current) return;

    isManualStopRef.current = true;

    try {
      recognitionRef.current.stop();
      setIsListening(false);
      console.log('🎤 Dictado detenido por el usuario');
    } catch (error) {
      console.error('Error al detener reconocimiento:', error);
      setIsListening(false);
    }
  }, []);

  // Función para alternar reconocimiento
  const toggle = useCallback(async () => {
    if (isListening) {
      stop();
    } else {
      await start();
    }
  }, [isListening, start, stop]);

  // Función para resetear transcript
  const resetTranscript = useCallback(() => {
    accumulatedFinalRef.current = '';
    setFinalTranscript('');
    setInterimTranscript('');
  }, []);

  // Combinar transcript final e interim
  const transcript = finalTranscript + (interimTranscript ? ' ' + interimTranscript : '');

  return {
    isSupported,
    isListening,
    transcript,
    finalTranscript,
    interimTranscript,
    permissionError,
    start,
    stop,
    toggle,
    resetTranscript,
  };
};
