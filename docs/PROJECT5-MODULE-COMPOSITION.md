# Project 5 app composition

Keep the optimized Core independent from app-specific storage and presentation.

| App | Composition | App-specific responsibilities |
| --- | --- | --- |
| GHÉP ẢNH 093 | Optimized Core + `modules/drive-storage-093` + 093 skin | Drive case creation, upload, search, reopen, metadata persistence |
| PTI | Optimized Core + GĐV administration module + PTI skin | GĐV administration, login, permissions and user directory |

The Drive module belongs to the 093 composition only. Do not load it from PTI's page or use its Drive API for PTI local drafts. Each skin wires its own controls to module APIs; shared image editing and session state stay in Core.

The Drive package requires a destination-specific Apps Script endpoint and backend Drive root. Its frontend deliberately has no endpoint fallback. Do not treat the Project 1 v25 endpoint in the retained source map as Project 5 configuration.
