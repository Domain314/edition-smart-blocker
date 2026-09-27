# Storage Scanner

A Firefox add-on for inspecting, editing, saving, and exporting the storage of the website in the active tab.

Requires Firefox 140 or newer (Firefox for Android 142 or newer).

## Features

- Local Storage and Session Storage key/value editing
- Cookies, including HttpOnly cookies exposed by Firefox's cookies API
- IndexedDB database, object-store, key, and value inspection
- Cache Storage request/response inspection, including text and base64-encoded binary bodies
- Add, edit, delete, restore, and save controls
- Selective JSON export with a native Firefox download prompt
- Isolated Shadow DOM overlay so website styles do not affect the interface

## Load in Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Select **Load Temporary Add-on…**.
3. Choose this folder's `manifest.json`.
4. Open a normal `http://` or `https://` page.
5. Click the Storage Scanner toolbar icon, then **Scan storage**.

Firefox does not permit extensions to run on protected pages such as `about:addons`, `about:debugging`, the built-in PDF viewer, or Mozilla's add-on site.

## Editing notes

- Changes remain in the overlay until **Save changes** is pressed for the active tab.
- **Rescan** discards unsaved changes after confirmation.
- IndexedDB keys and values use typed JSON. Tagged objects such as `{ "$type": "Date", "value": "…" }` preserve data that ordinary JSON cannot represent.
- IndexedDB database schemas are read-only. Records inside existing object stores can be changed.
- Cache response bodies are shown as text when their content type is textual, and as base64 otherwise. Opaque/unreadable response bodies are not overwritten.
- Export includes the values currently displayed, including unsaved edits. It never uploads data.

## Permissions and privacy

- `<all_urls>` lets the content script inspect the active website's origin storage.
- `cookies` is needed to include and edit HttpOnly cookies.
- `downloads` creates the user-requested JSON export.

All scanning and editing happens locally in Firefox. The add-on has no analytics, remote code, or network service, and declares `data_collection_permissions.required: ["none"]`.

## Validate or package

```fish
web-ext lint --source-dir .
web-ext build --source-dir .
```
