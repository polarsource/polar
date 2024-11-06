import { FontLoader } from 'three-stdlib';
import { suspend, preload, clear } from 'suspend-react';

let fontLoader = null;
async function loadFontData(font) {
  return typeof font === 'string' ? await (await fetch(font)).json() : font;
}
function parseFontData(fontData) {
  if (!fontLoader) {
    fontLoader = new FontLoader();
  }
  return fontLoader.parse(fontData);
}
async function loader(font) {
  const data = await loadFontData(font);
  return parseFontData(data);
}
function useFont(font) {
  return suspend(loader, [font]);
}
useFont.preload = font => preload(loader, [font]);
useFont.clear = font => clear([font]);

export { useFont };
