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
  return fileForm({}, { field, fileName, type, bytes }, boundary);
}

// Text as UTF-8 bytes. Its own encoder, so nothing depends on the phone
// having TextEncoder. A lone surrogate becomes the replacement character.
export function utf8Bytes(text: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let c = text.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length) {
      const d = text.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00);
        i++;
      }
    }
    if (c >= 0xd800 && c <= 0xdfff) c = 0xfffd;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return Uint8Array.from(out);
}

// A file with a few short text fields beside it (a post: the photo, how
// long, training or gym, the one-line note). The field names are ours; a
// value is what the person typed, sent as UTF-8 on one line (a line break
// in a value could end the part early, so there is never one).
export function fileForm(
  fields: Record<string, string>,
  file: { field: string; fileName: string; type: string; bytes: Uint8Array },
  boundary = makeBoundary(),
): Multipart {
  const parts: Uint8Array[] = [];
  for (const [name, value] of Object.entries(fields)) {
    parts.push(ascii(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n`));
    parts.push(utf8Bytes(value.replace(/[\r\n]+/g, " ")));
    parts.push(ascii("\r\n"));
  }
  parts.push(
    ascii(
      `--${boundary}\r\nContent-Disposition: form-data; name="${file.field}"; filename="${file.fileName}"\r\nContent-Type: ${file.type}\r\n\r\n`,
    ),
  );
  parts.push(file.bytes);
  parts.push(ascii(`\r\n--${boundary}--\r\n`));
  const body = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    body.set(p, at);
    at += p.length;
  }
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

function makeBoundary(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let b = "----StriveEliteUpload";
  for (let i = 0; i < 24; i++) b += chars[Math.floor(Math.random() * chars.length)];
  return b;
}
