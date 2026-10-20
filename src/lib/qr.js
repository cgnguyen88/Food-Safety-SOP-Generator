import qrcode from 'qrcode-generator';

const ERROR_CORRECTION = 'M';
const CELL_SIZE = 4;
const QUIET_ZONE = 4;

/**
 * A QR code for some text, as an SVG picture that scales to any size (white background, a quiet margin around it
 * so phones read it). Made here in the browser: the address in it is never sent to anyone to be turned into a picture.
 *
 * @param {string} text
 * @returns {string} SVG markup
 */
export function qrSvg(text) {
  const code = qrcode(0, ERROR_CORRECTION);
  code.addData(text);
  code.make();
  return code.createSvgTag({ cellSize: CELL_SIZE, margin: QUIET_ZONE, scalable: true });
}
