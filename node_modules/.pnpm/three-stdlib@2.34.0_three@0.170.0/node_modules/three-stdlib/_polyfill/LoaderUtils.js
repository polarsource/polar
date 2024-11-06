function decodeText(array) {
  if (typeof TextDecoder !== "undefined") {
    return new TextDecoder().decode(array);
  }
  let s = "";
  for (let i = 0, il = array.length; i < il; i++) {
    s += String.fromCharCode(array[i]);
  }
  try {
    return decodeURIComponent(escape(s));
  } catch (e) {
    return s;
  }
}
export {
  decodeText
};
//# sourceMappingURL=LoaderUtils.js.map
