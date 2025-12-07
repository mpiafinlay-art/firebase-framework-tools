/**
 * Helper para insertar texto de dictado correctamente
 * Previene duplicación y maneja interim/final results correctamente
 */

export interface DictationState {
  lastInsertedText: string;
  lastFinalText: string;
}

/**
 * Inserta texto de dictado en un elemento contentEditable
 * Solo inserta el texto nuevo, previniendo duplicación
 * 
 * ESTRATEGIA:
 * - Mantener el último liveTranscript insertado en state.lastInsertedText
 * - Solo insertar la diferencia (nuevo texto)
 * - Si liveTranscript es más corto que lastInsertedText, significa que se corrigió, resetear
 */
export function insertDictationTextToContentEditable(
  element: HTMLElement,
  liveTranscript: string,
  finalTranscript: string,
  interimTranscript?: string,
  state?: DictationState
): void {
  if (!element || !element.isContentEditable || !liveTranscript) return;

  // Crear estado si no se proporciona
  const dictationState = state || { lastInsertedText: '', lastFinalText: '' };

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);

  // Si el texto se corrigió (se hizo más corto), resetear estado
  // NOTA: Ya no usamos spans provisionales, así que no hay que limpiarlos
  if (liveTranscript.length < dictationState.lastInsertedText.length) {
    dictationState.lastInsertedText = '';
    dictationState.lastFinalText = '';
  }

  // CRÍTICO: Verificar si el texto ya está en el elemento para evitar duplicación
  const currentText = element.textContent || '';
  const currentTextTrimmed = currentText.trim();
  const liveTranscriptTrimmed = liveTranscript.trim();
  
  // Si el texto completo ya está en el elemento, no insertar nada
  if (currentTextTrimmed.includes(liveTranscriptTrimmed) && liveTranscriptTrimmed.length > 0) {
    // Verificar si el texto está al final del elemento (donde debería estar)
    const textEnd = currentTextTrimmed.slice(-liveTranscriptTrimmed.length);
    if (textEnd === liveTranscriptTrimmed) {
      // El texto ya está insertado, solo actualizar el estado
      dictationState.lastInsertedText = liveTranscript;
      if (finalTranscript) {
        dictationState.lastFinalText = finalTranscript;
      }
      return;
    }
  }

  // Calcular solo el texto nuevo a insertar
  let textToInsert = '';
  if (dictationState.lastInsertedText) {
    // Si liveTranscript empieza con lastInsertedText, solo insertar la diferencia
    if (liveTranscript.startsWith(dictationState.lastInsertedText)) {
      textToInsert = liveTranscript.slice(dictationState.lastInsertedText.length);
    } else {
      // Texto completamente nuevo, resetear
      dictationState.lastInsertedText = '';
      textToInsert = liveTranscript;
    }
  } else {
    // Primera vez, insertar todo
    textToInsert = liveTranscript;
  }

  // NOTA: Ya no usamos spans provisionales, así que no hay que eliminarlos

  // Solo insertar si hay texto nuevo
  if (textToInsert) {
    // Determinar si es texto final o provisional
    const isFinal = finalTranscript && liveTranscript === finalTranscript;
    const interimText = liveTranscript.length > finalTranscript.length 
      ? liveTranscript.slice(finalTranscript.length) 
      : '';

    // Usar interimTranscript si está disponible, sino calcularlo
    const actualInterimText = interimTranscript || (liveTranscript.length > finalTranscript.length 
      ? liveTranscript.slice(finalTranscript.length) 
      : '');
    
    if (isFinal || !actualInterimText) {
      // Insertar como texto normal (final) - negro
      const textNode = document.createTextNode(textToInsert);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      
      dictationState.lastInsertedText = liveTranscript;
      if (finalTranscript) {
        dictationState.lastFinalText = finalTranscript;
      }
    } else {
      // Insertar como texto provisional (gris) - preview en tiempo real
      const interimSpan = document.createElement('span');
      interimSpan.className = 'dictation-interim';
      interimSpan.style.color = '#888888'; // Gris para preview
      interimSpan.textContent = textToInsert;
      range.insertNode(interimSpan);
      range.setStartAfter(interimSpan);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      
      dictationState.lastInsertedText = liveTranscript;
    }
  }

  // Disparar evento input para autoguardado
  const inputEvent = new Event('input', { bubbles: true });
  element.dispatchEvent(inputEvent);
}

/**
 * Inserta texto de dictado en un input o textarea
 * Solo inserta el texto nuevo, previniendo duplicación
 * 
 * ESTRATEGIA: 
 * - Mantener el último liveTranscript insertado en state.lastInsertedText
 * - Solo insertar la diferencia (nuevo texto)
 * - Si liveTranscript es más corto que lastInsertedText, significa que se corrigió, resetear
 */
export function insertDictationTextToInput(
  element: HTMLInputElement | HTMLTextAreaElement,
  liveTranscript: string,
  finalTranscript: string,
  state?: DictationState
): void {
  if (!element || !liveTranscript) return;

  // Crear estado si no se proporciona
  const dictationState = state || { lastInsertedText: '', lastFinalText: '' };

  const currentValue = element.value;
  const cursorStart = element.selectionStart || currentValue.length;
  const cursorEnd = element.selectionEnd || cursorStart;

  // Si el texto se corrigió (se hizo más corto), resetear estado
  if (liveTranscript.length < dictationState.lastInsertedText.length) {
    dictationState.lastInsertedText = '';
    dictationState.lastFinalText = '';
  }

  // Calcular solo el texto nuevo a insertar
  let textToInsert = '';
  if (dictationState.lastInsertedText) {
    // Si liveTranscript empieza con lastInsertedText, solo insertar la diferencia
    if (liveTranscript.startsWith(dictationState.lastInsertedText)) {
      textToInsert = liveTranscript.slice(dictationState.lastInsertedText.length);
    } else {
      // Texto completamente nuevo, resetear
      dictationState.lastInsertedText = '';
      textToInsert = liveTranscript;
    }
  } else {
    // Primera vez, insertar todo
    textToInsert = liveTranscript;
  }

  // Solo insertar si hay texto nuevo
  if (textToInsert) {
    const beforeCursor = currentValue.slice(0, cursorStart);
    const afterCursor = currentValue.slice(cursorEnd);
    
    // Verificar que el texto antes del cursor no contenga ya el texto completo
    // (para evitar duplicación si el usuario ya escribió algo)
    if (!beforeCursor.endsWith(liveTranscript)) {
      element.value = beforeCursor + textToInsert + afterCursor;
      const newCursorPosition = beforeCursor.length + textToInsert.length;
      element.setSelectionRange(newCursorPosition, newCursorPosition);
      
      dictationState.lastInsertedText = liveTranscript;
      
      // Actualizar lastFinalText si hay texto final
      if (finalTranscript) {
        dictationState.lastFinalText = finalTranscript;
      }
    }
  }

  // Disparar evento input para actualizar estado
  const inputEvent = new Event('input', { bubbles: true });
  element.dispatchEvent(inputEvent);
}

/**
 * Convierte texto provisional a final (cuando se finaliza) - cambia de gris a negro
 */
export function finalizeInterimText(element: HTMLElement | HTMLInputElement | HTMLTextAreaElement): void {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    // Para inputs, el texto provisional ya está en el value
    return;
  }

  // Para contentEditable, convertir spans provisionales (gris) a texto normal (negro)
  const interimSpans = element.querySelectorAll('.dictation-interim');
  interimSpans.forEach((span) => {
    const text = span.textContent || '';
    const textNode = document.createTextNode(text);
    textNode.textContent = text; // Asegurar que es texto negro
    span.parentNode?.replaceChild(textNode, span);
  });
}
