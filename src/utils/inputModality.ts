/**
 * Remembers on <html data-input> whether the last way focus moved was a pointer
 * or the keyboard (Tab). Chrome shows a focus ring as soon as any key is pressed,
 * so shortcuts used after a click would ring whatever was clicked; the editor
 * keeps rings for keyboard navigation only, and lets Space play after a click.
 * Before any interaction it counts as the keyboard.
 */
export function trackInputModality(root = document.documentElement) {
  window.addEventListener('pointerdown', () => (root.dataset.input = 'pointer'), true)
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Tab') root.dataset.input = 'keyboard'
    },
    true,
  )
}

export const usingPointer = () => document.documentElement.dataset.input === 'pointer'
