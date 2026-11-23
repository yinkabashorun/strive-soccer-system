// A file upload, built by hand as bytes.
//
// Why by hand: this Expo version replaces the phone's fetch with its own,
// and that one refuses the React Native way of sending a file (a form part
// that is just { uri, name, type }): the request never leaves the phone.
// The first TestFlight build of this app could not save a profile photo for
// that reason (Nov 23 2026). Bytes with a Content-Type header are accepted
// by every fetch, so the upload is one JPEG in one multipart body, made
// here, with nothing left to how a given fetch treats a form.
//
// Shared with the phone ("@shared/upload-body") and pure, so the site's
// tests can run it: tests/app-device.test.ts sends what this builds through
// the same Request.formData() the server uses and gets the photo back byte
// for byte.

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

// Base64 text (what the phone's image tool hands back) to bytes. Its own
// decoder, so nothing depends on the phone having atob.
export function base64ToBytes(input: string): Uint8Array {
  const text = input.replace(/[^A-Za-z0-9+/]/g, "");
  const out = new Uint8Array(Math.floor((text.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < text.length; i += 4) {
    const a = B64.indexOf(text[i]);
    const b = B64.indexOf(text[i + 1] ?? "A");
    const c = i + 2 < text.length ? B64.indexOf(text[i + 2]) : -1;
    const d = i + 3 < text.length ? B64.indexOf(text[i + 3]) : -1;
    out[o++] = (a << 2) | (b >> 4);
    if (c >= 0) out[o++] = ((b & 15) << 4) | (c >> 2);
    if (d >= 0) out[o++] = ((c & 3) << 6) | d;
  }
  return out.subarray(0, o);
}

function ascii(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0x7f;
  return out;
}

export type Multipart = { body: Uint8Array; contentType: string };

// One file under one field name. The field, file name and type are ours
// (plain ASCII), never typed by anyone.
export function oneFileForm(field: string, fileName: string, type: string, bytes: Uint8Array, boundary = makeBoundary()): Multipart {
  const head = ascii(
    `--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="${fileName}"\r\nContent-Type: ${type}\r\n\r\n`,
  );
  const tail = ascii(`\r\n--${boundary}--\r\n`);
  const body = new Uint8Array(head.length + bytes.length + tail.length);
  body.set(head, 0);
  body.set(bytes, head.length);
  body.set(tail, head.length + bytes.length);
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

function makeBoundary(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let b = "----StriveEliteUpload";
  for (let i = 0; i < 24; i++) b += chars[Math.floor(Math.random() * chars.length)];
  return b;
}
