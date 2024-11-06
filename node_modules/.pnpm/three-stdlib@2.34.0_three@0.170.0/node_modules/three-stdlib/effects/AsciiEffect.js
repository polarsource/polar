class AsciiEffect {
  constructor(renderer, charSet = " .:-=+*#%@", options = {}) {
    const fResolution = options["resolution"] || 0.15;
    const iScale = options["scale"] || 1;
    const bColor = options["color"] || false;
    const bAlpha = options["alpha"] || false;
    const bBlock = options["block"] || false;
    const bInvert = options["invert"] || false;
    const strResolution = options["strResolution"] || "low";
    let width, height;
    const domElement = document.createElement("div");
    domElement.style.cursor = "default";
    const oAscii = document.createElement("table");
    domElement.appendChild(oAscii);
    let iWidth, iHeight;
    let oImg;
    this.setSize = function(w, h) {
      width = w;
      height = h;
      renderer.setSize(w, h);
      initAsciiSize();
    };
    this.render = function(scene, camera) {
      renderer.render(scene, camera);
      asciifyImage(oAscii);
    };
    this.domElement = domElement;
    function initAsciiSize() {
      iWidth = Math.floor(width * fResolution);
      iHeight = Math.floor(height * fResolution);
      oCanvas.width = iWidth;
      oCanvas.height = iHeight;
      oImg = renderer.domElement;
      if (oImg.style.backgroundColor) {
        oAscii.rows[0].cells[0].style.backgroundColor = oImg.style.backgroundColor;
        oAscii.rows[0].cells[0].style.color = oImg.style.color;
      }
      oAscii.cellSpacing = 0;
      oAscii.cellPadding = 0;
      const oStyle = oAscii.style;
      oStyle.whiteSpace = "pre";
      oStyle.margin = "0px";
      oStyle.padding = "0px";
      oStyle.letterSpacing = fLetterSpacing + "px";
      oStyle.fontFamily = strFont;
      oStyle.fontSize = fFontSize + "px";
      oStyle.lineHeight = fLineHeight + "px";
      oStyle.textAlign = "left";
      oStyle.textDecoration = "none";
    }
    const aDefaultCharList = " .,:;i1tfLCG08@".split("");
    const aDefaultColorCharList = " CGO08@".split("");
    const strFont = "courier new, monospace";
    const oCanvasImg = renderer.domElement;
    const oCanvas = document.createElement("canvas");
    if (!oCanvas.getContext) {
      return;
    }
    const oCtx = oCanvas.getContext("2d");
    if (!oCtx.getImageData) {
      return;
    }
    let aCharList = bColor ? aDefaultColorCharList : aDefaultCharList;
    if (charSet)
      aCharList = charSet;
    const fFontSize = 2 / fResolution * iScale;
    const fLineHeight = 2 / fResolution * iScale;
    let fLetterSpacing = 0;
    if (strResolution == "low") {
      switch (iScale) {
        case 1:
          fLetterSpacing = -1;
          break;
        case 2:
        case 3:
          fLetterSpacing = -2.1;
          break;
        case 4:
          fLetterSpacing = -3.1;
          break;
        case 5:
          fLetterSpacing = -4.15;
          break;
      }
    }
    if (strResolution == "medium") {
      switch (iScale) {
        case 1:
          fLetterSpacing = 0;
          break;
        case 2:
          fLetterSpacing = -1;
          break;
        case 3:
          fLetterSpacing = -1.04;
          break;
        case 4:
        case 5:
          fLetterSpacing = -2.1;
          break;
      }
    }
    if (strResolution == "high") {
      switch (iScale) {
        case 1:
        case 2:
          fLetterSpacing = 0;
          break;
        case 3:
        case 4:
        case 5:
          fLetterSpacing = -1;
          break;
      }
    }
    function asciifyImage(oAscii2) {
      oCtx.clearRect(0, 0, iWidth, iHeight);
      oCtx.drawImage(oCanvasImg, 0, 0, iWidth, iHeight);
      const oImgData = oCtx.getImageData(0, 0, iWidth, iHeight).data;
      let strChars = "";
      for (let y = 0; y < iHeight; y += 2) {
        for (let x = 0; x < iWidth; x++) {
          const iOffset = (y * iWidth + x) * 4;
          const iRed = oImgData[iOffset];
          const iGreen = oImgData[iOffset + 1];
          const iBlue = oImgData[iOffset + 2];
          const iAlpha = oImgData[iOffset + 3];
          let iCharIdx;
          let fBrightness;
          fBrightness = (0.3 * iRed + 0.59 * iGreen + 0.11 * iBlue) / 255;
          if (iAlpha == 0) {
            fBrightness = 1;
          }
          iCharIdx = Math.floor((1 - fBrightness) * (aCharList.length - 1));
          if (bInvert) {
            iCharIdx = aCharList.length - iCharIdx - 1;
          }
          let strThisChar = aCharList[iCharIdx];
          if (strThisChar === void 0 || strThisChar == " ")
            strThisChar = "&nbsp;";
          if (bColor) {
            strChars += "<span style='color:rgb(" + iRed + "," + iGreen + "," + iBlue + ");" + (bBlock ? "background-color:rgb(" + iRed + "," + iGreen + "," + iBlue + ");" : "") + (bAlpha ? "opacity:" + iAlpha / 255 + ";" : "") + "'>" + strThisChar + "</span>";
          } else {
            strChars += strThisChar;
          }
        }
        strChars += "<br/>";
      }
      oAscii2.innerHTML = `<tr><td style="display:block;width:${width}px;height:${height}px;overflow:hidden">${strChars}</td></tr>`;
    }
  }
}
export {
  AsciiEffect
};
//# sourceMappingURL=AsciiEffect.js.map
