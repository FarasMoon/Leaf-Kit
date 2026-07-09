// ============================================================
// multipart.js — multipart/form-data parser
// ============================================================

function parseMultipart(buffer, boundary) {
  const result = { fields: {}, file: null, filename: "" };
  const b = Buffer.from("--" + boundary);
  const endB = Buffer.from("--" + boundary + "--");
  let pos = buffer.indexOf(b) + b.length;

  while (pos < buffer.length - endB.length) {
    if (buffer[pos] === 13) pos += 2;
    let headerEnd = buffer.indexOf("\r\n\r\n", pos);
    if (headerEnd === -1) break;
    const headerText = buffer.slice(pos, headerEnd).toString();
    pos = headerEnd + 4;

    const nameMatch = headerText.match(/name="([^"]+)"/);
    const filenameMatch = headerText.match(/filename="([^"]+)"/);
    const name = nameMatch ? nameMatch[1] : "";

    const nextBoundary = buffer.indexOf(b, pos);
    if (nextBoundary === -1) break;
    let dataEnd = nextBoundary - 2;
    if (buffer[dataEnd - 1] !== 13) dataEnd = nextBoundary;
    const data = buffer.slice(pos, dataEnd);

    if (filenameMatch) {
      result.filename = filenameMatch[1];
      result.file = data;
    } else if (name) {
      result.fields[name] = data.toString().replace(/[\r\n\s]+$/, "");
    }

    pos = nextBoundary + b.length;
  }

  return result;
}

module.exports = { parseMultipart };
