export type Vector2 = [number, number]
export type WebKitGestureEvent = PointerEvent & { scale: number; rotation: number }
export type Target = EventTarget | { current: EventTarget | null }
export type PointerType = 'mouse' | 'touch' | 'pen'

// replaces NonUndefined from 4.7 and inferior versions
export type NonUndefined<T> = T extends undefined ? never : T
export type EventHandler<E extends Event = Event> = (event: E) => void

// rip off from React types
export interface DOMHandlers {
  // Clipboard Events
  onCopy?: EventHandler<ClipboardEvent>
  onCopyCapture?: EventHandler<ClipboardEvent>
  onCut?: EventHandler<ClipboardEvent>
  onCutCapture?: EventHandler<ClipboardEvent>
  onPaste?: EventHandler<ClipboardEvent>
  onPasteCapture?: EventHandler<ClipboardEvent>

  // Composition Events
  onCompositionEnd?: EventHandler<CompositionEvent>
  onCompositionEndCapture?: EventHandler<CompositionEvent>
  onCompositionStart?: EventHandler<CompositionEvent>
  onCompositionStartCapture?: EventHandler<CompositionEvent>
  onCompositionUpdate?: EventHandler<CompositionEvent>
  onCompositionUpdateCapture?: EventHandler<CompositionEvent>

  // Focus Events
  onFocus?: EventHandler<FocusEvent>
  onFocusCapture?: EventHandler<FocusEvent>
  onBlur?: EventHandler<FocusEvent>
  onBlurCapture?: EventHandler<FocusEvent>

  // Form Events
  onChange?: EventHandler<FormDataEvent>
  onChangeCapture?: EventHandler<FormDataEvent>
  onBeforeInput?: EventHandler<FormDataEvent>
  onBeforeInputCapture?: EventHandler<FormDataEvent>
  onInput?: EventHandler<FormDataEvent>
  onInputCapture?: EventHandler<FormDataEvent>
  onReset?: EventHandler<FormDataEvent>
  onResetCapture?: EventHandler<FormDataEvent>
  onSubmit?: EventHandler<FormDataEvent>
  onSubmitCapture?: EventHandler<FormDataEvent>
  onInvalid?: EventHandler<FormDataEvent>
  onInvalidCapture?: EventHandler<FormDataEvent>

  // Image Events
  onLoad?: EventHandler
  onLoadCapture?: EventHandler
  onError?: EventHandler // also a Media Event
  onErrorCapture?: EventHandler // also a Media Event

  // Keyboard Events
  onKeyDown?: EventHandler<KeyboardEvent>
  onKeyDownCapture?: EventHandler<KeyboardEvent>
  onKeyUp?: EventHandler<KeyboardEvent>
  onKeyUpCapture?: EventHandler<KeyboardEvent>

  // Media Events
  onAbort?: EventHandler
  onAbortCapture?: EventHandler
  onCanPlay?: EventHandler
  onCanPlayCapture?: EventHandler
  onCanPlayThrough?: EventHandler
  onCanPlayThroughCapture?: EventHandler
  onDurationChange?: EventHandler
  onDurationChangeCapture?: EventHandler
  onEmptied?: EventHandler
  onEmptiedCapture?: EventHandler
  onEncrypted?: EventHandler
  onEncryptedCapture?: EventHandler
  onEnded?: EventHandler
  onEndedCapture?: EventHandler
  onLoadedData?: EventHandler
  onLoadedDataCapture?: EventHandler
  onLoadedMetadata?: EventHandler
  onLoadedMetadataCapture?: EventHandler
  onLoadStart?: EventHandler
  onLoadStartCapture?: EventHandler
  onPause?: EventHandler
  onPauseCapture?: EventHandler
  onPlay?: EventHandler
  onPlayCapture?: EventHandler
  onPlaying?: EventHandler
  onPlayingCapture?: EventHandler
  onProgress?: EventHandler
  onProgressCapture?: EventHandler
  onRateChange?: EventHandler
  onRateChangeCapture?: EventHandler
  onSeeked?: EventHandler
  onSeekedCapture?: EventHandler
  onSeeking?: EventHandler
  onSeekingCapture?: EventHandler
  onStalled?: EventHandler
  onStalledCapture?: EventHandler
  onSuspend?: EventHandler
  onSuspendCapture?: EventHandler
  onTimeUpdate?: EventHandler
  onTimeUpdateCapture?: EventHandler
  onVolumeChange?: EventHandler
  onVolumeChangeCapture?: EventHandler
  onWaiting?: EventHandler
  onWaitingCapture?: EventHandler

  // MouseEvents
  onAuxClick?: EventHandler<MouseEvent>
  onAuxClickCapture?: EventHandler<MouseEvent>
  onClick?: EventHandler<MouseEvent>
  onClickCapture?: EventHandler<MouseEvent>
  onContextMenu?: EventHandler<MouseEvent>
  onContextMenuCapture?: EventHandler<MouseEvent>
  onDoubleClick?: EventHandler<MouseEvent>
  onDoubleClickCapture?: EventHandler<MouseEvent>
  onDrag?: EventHandler<DragEvent>
  onDragCapture?: EventHandler<DragEvent>
  onDragEnd?: EventHandler<DragEvent>
  onDragEndCapture?: EventHandler<DragEvent>
  onDragEnter?: EventHandler<DragEvent>
  onDragEnterCapture?: EventHandler<DragEvent>
  onDragExit?: EventHandler<DragEvent>
  onDragExitCapture?: EventHandler<DragEvent>
  onDragLeave?: EventHandler<DragEvent>
  onDragLeaveCapture?: EventHandler<DragEvent>
  onDragOver?: EventHandler<DragEvent>
  onDragOverCapture?: EventHandler<DragEvent>
  onDragStart?: EventHandler<DragEvent>
  onDragStartCapture?: EventHandler<DragEvent>
  onDrop?: EventHandler<DragEvent>
  onDropCapture?: EventHandler<DragEvent>
  onMouseDown?: EventHandler<MouseEvent>
  onMouseDownCapture?: EventHandler<MouseEvent>
  onMouseEnter?: EventHandler<MouseEvent>
  onMouseLeave?: EventHandler<MouseEvent>
  onMouseMove?: EventHandler<MouseEvent>
  onMouseMoveCapture?: EventHandler<MouseEvent>
  onMouseOut?: EventHandler<MouseEvent>
  onMouseOutCapture?: EventHandler<MouseEvent>
  onMouseOver?: EventHandler<MouseEvent>
  onMouseOverCapture?: EventHandler<MouseEvent>
  onMouseUp?: EventHandler<MouseEvent>
  onMouseUpCapture?: EventHandler<MouseEvent>

  // Selection Events
  onSelect?: EventHandler
  onSelectCapture?: EventHandler

  // Touch Events
  onTouchCancel?: EventHandler<TouchEvent>
  onTouchCancelCapture?: EventHandler<TouchEvent>
  onTouchEnd?: EventHandler<TouchEvent>
  onTouchEndCapture?: EventHandler<TouchEvent>
  onTouchMove?: EventHandler<TouchEvent>
  onTouchMoveCapture?: EventHandler<TouchEvent>
  onTouchStart?: EventHandler<TouchEvent>
  onTouchStartCapture?: EventHandler<TouchEvent>

  // Pointer Events
  onPointerDown?: EventHandler<PointerEvent>
  onPointerDownCapture?: EventHandler<PointerEvent>
  onPointerMove?: EventHandler<PointerEvent>
  onPointerMoveCapture?: EventHandler<PointerEvent>
  onPointerUp?: EventHandler<PointerEvent>
  onPointerUpCapture?: EventHandler<PointerEvent>
  onPointerCancel?: EventHandler<PointerEvent>
  onPointerCancelCapture?: EventHandler<PointerEvent>
  onPointerEnter?: EventHandler<PointerEvent>
  onPointerLeave?: EventHandler<PointerEvent>
  onPointerOver?: EventHandler<PointerEvent>
  onPointerOverCapture?: EventHandler<PointerEvent>
  onPointerOut?: EventHandler<PointerEvent>
  onPointerOutCapture?: EventHandler<PointerEvent>
  onGotPointerCapture?: EventHandler<PointerEvent>
  onGotPointerCaptureCapture?: EventHandler<PointerEvent>
  onLostPointerCapture?: EventHandler<PointerEvent>
  onLostPointerCaptureCapture?: EventHandler<PointerEvent>

  // UI Events
  onScroll?: EventHandler<UIEvent>
  onScrollCapture?: EventHandler<UIEvent>

  // Wheel Events
  onWheel?: EventHandler<WheelEvent>
  onWheelCapture?: EventHandler<WheelEvent>

  // Animation Events
  onAnimationStart?: EventHandler<AnimationEvent>
  onAnimationStartCapture?: EventHandler<AnimationEvent>
  onAnimationEnd?: EventHandler<AnimationEvent>
  onAnimationEndCapture?: EventHandler<AnimationEvent>
  onAnimationIteration?: EventHandler<AnimationEvent>
  onAnimationIterationCapture?: EventHandler<AnimationEvent>

  // Transition Events
  onTransitionEnd?: EventHandler<TransitionEvent>
  onTransitionEndCapture?: EventHandler<TransitionEvent>
}
