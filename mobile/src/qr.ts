import qrcode from "qrcode-generator";

// A QR code as its squares, worked out on the phone (no picture is
// fetched, nothing is sent anywhere): which squares of the grid are dark.
//
// The one thing a player's code holds is their own invite link
// (app/friend/code.tsx). Another iPhone's camera reads it and opens the
// link; the app has no scanner of its own.
//
// "qrcode-generator" is plain JavaScript with no native part, so the iPhone
// build is not touched by it. Error correction M (15%): a code that still
// reads with a thumb over a corner or a cracked screen, at a size the
// camera reads from arm's length.
export function qrModules(text: string): boolean[][] {
  const qr = qrcode(0, "M");
  qr.addData(text, "Byte");
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, row) => Array.from({ length: n }, (_, col) => qr.isDark(row, col)));
}

// The white margin a scanner needs around the code, in squares (the QR
// standard asks for four).
export const QUIET_ZONE = 4;

// The dark squares as ONE drawing path on a grid of `size` units a side,
// the quiet zone included: each run of dark squares in a row is one
// rectangle, so a code is a few hundred short strokes, not a thousand views.
export function qrPath(modules: boolean[][], quiet = QUIET_ZONE): { size: number; d: string } {
  const n = modules.length;
  let d = "";
  for (let row = 0; row < n; row++) {
    let col = 0;
    while (col < n) {
      if (!modules[row][col]) {
        col++;
        continue;
      }
      let end = col;
      while (end < n && modules[row][end]) end++;
      d += `M${col + quiet} ${row + quiet}h${end - col}v1h-${end - col}z`;
      col = end;
    }
  }
  return { size: n + quiet * 2, d };
}
