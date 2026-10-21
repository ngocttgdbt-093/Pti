/**
 * PTI_GDV_ADMIN_API — backend quản trị GĐV RIÊNG cho dự án GHÉP ẢNH PTI.
 * Không truy cập hồ sơ/ảnh/Drive hoặc bất kỳ API nào của dự án 093.
 *
 * TRIỂN KHAI:
 * 1. Mở đúng Google Apps Script project PTI_GDV_ADMIN_API (không phải PTI093_DATA_API).
 * 2. Thay toàn bộ Code.gs bằng mã này và lưu.
 * 3. Project Settings > Script Properties:
 *      ADMIN_PASSWORD_HASH = SHA-256 dạng hex của mật khẩu quản trị hiện tại.
 *    Giữ nguyên giá trị đang dùng nếu đã cấu hình đúng; không đặt mật khẩu thô vào mã.
 * 4. Deploy > Manage deployments > Edit (biểu tượng bút chì) > New version > Deploy.
 *    Giữ nguyên URL /exec hiện dùng trong giao diện test1.
 *
 * Hỗ trợ cả POST JSON (nếu client gọi trực tiếp) và POST form bridge:
 * bridge=1, requestId=..., payload='{"action":"login",...}'
 * Bridge trả HTML trong iframe và postMessage về trang PTI.
 */
const PTI_GDV_KEY = 'PTI_GDV_NAMES_V1';
const PTI_GDV_TOKEN_PREFIX = 'PTI_GDV_TOKEN_';
const PTI_GDV_TOKEN_TTL = 6 * 60 * 60 * 1000;
const PTI_GDV_SERVICE = 'PTI_GDV_ADMIN_API';
const PTI_GDV_VERSION = 2;

function doGet() {
  return jsonOut_({
    ok: true,
    service: PTI_GDV_SERVICE,
    version: PTI_GDV_VERSION,
    bridge: true
  });
}

function doPost(e) {
  const params = (e && e.parameter) || {};
  const isBridge = String(params.bridge || '') === '1';
  const requestId = String(params.requestId || '');
  try {
    let req;
    if (isBridge) {
      req = JSON.parse(String(params.payload || '{}'));
    } else {
      req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    }
    const result = handleRequest_(req);
    return isBridge ? bridgeOut_(requestId, result) : jsonOut_(result);
  } catch (err) {
    const result = { ok: false, error: 'SERVER_ERROR', message: String(err && err.message || err) };
    return isBridge ? bridgeOut_(requestId, result) : jsonOut_(result);
  }
}

function handleRequest_(req) {
  req = req || {};
  const action = String(req.action || '');
  if (action === 'login') return login_(req);
  if (action === 'publicList') return { ok: true, names: readNames_() };

  const token = String(req.token || '');
  if (!validToken_(token)) return { ok: false, error: 'UNAUTHORIZED' };

  if (action === 'list') return { ok: true, names: readNames_() };
  if (action === 'save') return saveNames_(req.names);
  if (action === 'logout') {
    PropertiesService.getScriptProperties().deleteProperty(PTI_GDV_TOKEN_PREFIX + token);
    return { ok: true };
  }
  return { ok: false, error: 'UNKNOWN_ACTION' };
}

function bridgeOut_(requestId, result) {
  const packet = JSON.stringify({
    type: 'PTI_GDV_API_RESULT',
    requestId: String(requestId || ''),
    result: result
  });
  // Escaping JSON for safe inclusion inside a JavaScript string literal.
  const packetLiteral = JSON.stringify(packet)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
  const html = '<!doctype html><html><head><meta charset="utf-8"></head><body>' +
    '<script>(function(){var packet=JSON.parse(' + packetLiteral + ');' +
    'try{window.top.postMessage(packet,"*");}catch(e){}' +
    '})();</script></body></html>';
  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function login_(req) {
  if (String(req.username || '') !== 'Administrator') {
    return { ok: false, error: 'INVALID_LOGIN' };
  }
  const props = PropertiesService.getScriptProperties();
  const expected = props.getProperty('ADMIN_PASSWORD_HASH');
  if (!expected) return { ok: false, error: 'ADMIN_PASSWORD_NOT_CONFIGURED' };

  const actual = sha256Hex_(String(req.password || ''));
  if (!constantTimeEqual_(actual, expected.trim().toLowerCase())) {
    return { ok: false, error: 'INVALID_LOGIN' };
  }

  const token = Utilities.getUuid().replace(/-/g, '') +
                Utilities.getUuid().replace(/-/g, '');
  props.setProperty(PTI_GDV_TOKEN_PREFIX + token,
                    String(Date.now() + PTI_GDV_TOKEN_TTL));
  return { ok: true, token: token, expiresIn: PTI_GDV_TOKEN_TTL };
}

function validToken_(token) {
  if (!/^[a-f0-9]{64}$/i.test(token)) return false;
  const props = PropertiesService.getScriptProperties();
  const expiry = Number(props.getProperty(PTI_GDV_TOKEN_PREFIX + token) || 0);
  if (!expiry || expiry < Date.now()) {
    props.deleteProperty(PTI_GDV_TOKEN_PREFIX + token);
    return false;
  }
  return true;
}

function readNames_() {
  const raw = PropertiesService.getScriptProperties().getProperty(PTI_GDV_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch (err) {}
  }
  return [
    'Bùi Tiến Lâm','Đặng Nam Hải','Đặng Quốc Trình','Nguyễn Hùng Cường',
    'Nguyễn Viết Vịnh','Phạm Bá Lưu','Phạm Đình Chiến','Phạm Văn Hải',
    'Tăng Tiến Mạnh','Trần Thanh Sơn','Võ Minh Quyền','Vũ Văn Chính'
  ];
}

function saveNames_(input) {
  if (!Array.isArray(input)) return { ok: false, error: 'INVALID_NAMES' };
  const seen = Object.create(null);
  const names = [];
  input.forEach(function(value) {
    const name = String(value || '').trim().replace(/\\s+/g, ' ');
    if (!name || name.length > 100) return;
    const key = name.toLocaleLowerCase('vi');
    if (!seen[key]) {
      seen[key] = true;
      names.push(name);
    }
  });
  if (names.length > 200) return { ok: false, error: 'TOO_MANY_NAMES' };
  names.sort(function(a, b) { return a.localeCompare(b, 'vi'); });
  PropertiesService.getScriptProperties()
    .setProperty(PTI_GDV_KEY, JSON.stringify(names));
  return { ok: true, names: names };
}

function sha256Hex_(value) {
  return Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    value,
    Utilities.Charset.UTF_8
  ).map(function(byteValue) {
    return ('0' + ((byteValue + 256) % 256).toString(16)).slice(-2);
  }).join('');
}

function constantTimeEqual_(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
