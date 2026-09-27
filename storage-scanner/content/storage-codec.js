(() => {
  "use strict";

  function bytesToBase64(bytes) {
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  function base64ToBytes(value) {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  async function encode(value, seen = new WeakSet()) {
    if (value === undefined) return { $type: "Undefined" };
    if (typeof value === "bigint") return { $type: "BigInt", value: value.toString() };
    if (typeof value === "number" && !Number.isFinite(value)) return { $type: "Number", value: String(value) };
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
    if (typeof value !== "object") return { $type: "Unsupported", value: String(value) };
    if (value instanceof Date) return { $type: "Date", value: value.toISOString() };
    if (value instanceof RegExp) return { $type: "RegExp", source: value.source, flags: value.flags };
    if (value instanceof ArrayBuffer) return { $type: "ArrayBuffer", value: bytesToBase64(new Uint8Array(value)) };
    if (ArrayBuffer.isView(value)) {
      return {
        $type: value.constructor.name,
        value: bytesToBase64(new Uint8Array(value.buffer, value.byteOffset, value.byteLength))
      };
    }
    if (value instanceof Blob) {
      return {
        $type: value instanceof File ? "File" : "Blob",
        mime: value.type,
        name: value instanceof File ? value.name : undefined,
        lastModified: value instanceof File ? value.lastModified : undefined,
        value: bytesToBase64(new Uint8Array(await value.arrayBuffer()))
      };
    }
    if (seen.has(value)) return { $type: "CircularReference" };
    seen.add(value);
    if (value instanceof Map) {
      const entries = [];
      for (const [key, item] of value) entries.push([await encode(key, seen), await encode(item, seen)]);
      seen.delete(value);
      return { $type: "Map", value: entries };
    }
    if (value instanceof Set) {
      const items = [];
      for (const item of value) items.push(await encode(item, seen));
      seen.delete(value);
      return { $type: "Set", value: items };
    }
    if (Array.isArray(value)) {
      const items = [];
      for (const item of value) items.push(await encode(item, seen));
      seen.delete(value);
      return items;
    }

    const result = {};
    for (const key of Object.keys(value)) result[key] = await encode(value[key], seen);
    seen.delete(value);
    return result;
  }

  function decode(value) {
    if (value === null || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(decode);
    if (!value.$type) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decode(item)]));
    switch (value.$type) {
      case "Undefined": return undefined;
      case "BigInt": return BigInt(value.value);
      case "Number": return Number(value.value);
      case "Date": return new Date(value.value);
      case "RegExp": return new RegExp(value.source, value.flags);
      case "ArrayBuffer": return base64ToBytes(value.value).buffer;
      case "Blob": return new Blob([base64ToBytes(value.value)], { type: value.mime || "" });
      case "File": return new File([base64ToBytes(value.value)], value.name || "file", { type: value.mime || "", lastModified: value.lastModified });
      case "Map": return new Map(value.value.map(([key, item]) => [decode(key), decode(item)]));
      case "Set": return new Set(value.value.map(decode));
      case "CircularReference": throw new Error("Cyclic IndexedDB values can be viewed, but cannot be saved by this version.");
      case "Unsupported": throw new Error(`Unsupported value: ${value.value}`);
      default: {
        const bytes = base64ToBytes(value.value);
        const Constructor = globalThis[value.$type];
        if (typeof Constructor !== "function") throw new Error(`Unknown typed value: ${value.$type}`);
        return new Constructor(bytes.buffer);
      }
    }
  }

  function stringify(value, spacing = 2) {
    return JSON.stringify(value, null, spacing);
  }

  globalThis.StorageScannerCodec = { encode, decode, stringify, bytesToBase64, base64ToBytes };
})();
