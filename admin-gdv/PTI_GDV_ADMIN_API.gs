/**
 * PTI_GDV_ADMIN_API — backend độc lập chỉ quản trị danh sách GĐV cho GHÉP ẢNH PTI.
 * Không đọc/ghi hồ sơ, ảnh, thư mục Drive hoặc dữ liệu của ứng dụng 093.
 *
 * Cài đặt trước khi triển khai:
 * 1) Tạo một Apps Script project RIÊNG.
 * 2) Dán tệp này vào Code.gs.
 * 3) Project Settings > Script Properties: đặt ADMIN_PASSWORD_HASH thành SHA-256 hex
 *    của mật khẩu quản trị. Không lưu mật khẩu thô trong mã nguồn.
 * 4) Deploy > New deployment > Web app; Execute as Me; Who has access: Anyone.
 * 5) Đặt URL /exec vào PTI_GDV_ADMIN_API_URL trong giao diện PTI.
 *
 * Giao thức: POST JSON dưới dạng text/plain; mỗi yêu cầu (trừ login) cần token.
 */
const PTI_GDV_KEY = 'PTI_GDV_NAMES_V1';
const PTI_GDV_TOKEN_PREFIX = 'PTI_GDV_TOKEN_';
const PTI_GDV_TOKEN_TTL = 6 * 60 * 60 * 1000;

function doGet() {
  return jsonOut_({ ok: true, service: 'PTI_GDV_ADMIN_API', version: 1 });
}

function doPost(e) {
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const action = String(req.action || '');
    if (action === 'login') return jsonOut_(login_(req));
    if (action === 'publicList') return jsonOut_({ ok: true, names: readNames_() });
    const token = String(req.token || '');
    if (!validToken_(token)) return jsonOut_({ ok: false, error: 'UNAUTHORIZED' });
    if (action === 'list') return jsonOut_({ ok: true, names: readNames_() });
    if (action === 'save') return jsonOut_(saveNames_(req.names));
    if (action === 'logout') {
      PropertiesService.getScriptProperties().deleteProperty(PTI_GDV_TOKEN_PREFIX + token);
      return jsonOut_({ ok: true });
    }
    return jsonOut_({ ok: false, error: 'UNKNOWN_ACTION' });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err && err.message || err) });
  }
}

function login_(req) {
  if (String(req.username || '') !== 'Administrator') return { ok: false, error: 'INVALID_LOGIN' };
  const expected = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD_HASH');
  if (!expected) return { ok: false, error: 'ADMIN_PASSWORD_NOT_CONFIGURED' };
  const actual = sha256Hex_(String(req.password || ''));
  if (!constantTimeEqual_(actual, expected.trim().toLowerCase())) return { ok: false, error: 'INVALID_LOGIN' };
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty(PTI_GDV_TOKEN_PREFIX + token, String(Date.now() + PTI_GDV_TOKEN_TTL));
  return { ok: true, token: token, expiresIn: PTI_GDV_TOKEN_TTL };
}
function validToken_(token) {
  if (!/^[a-f0-9]{64}$/i.test(token)) return false;
  const p = PropertiesService.getScriptProperties();
  const expiry = Number(p.getProperty(PTI_GDV_TOKEN_PREFIX + token) || 0);
  if (!expiry || expiry < Date.now()) { p.deleteProperty(PTI_GDV_TOKEN_PREFIX + token); return false; }
  return true;
}
function readNames_() {
  const raw = PropertiesService.getScriptProperties().getProperty(PTI_GDV_KEY);
  if (raw) return JSON.parse(raw);
  return ['Bùi Tiến Lâm','Đặng Nam Hải','Đặng Quốc Trình','Nguyễn Hùng Cường','Nguyễn Viết Vịnh','Phạm Bá Lưu','Phạm Đình Chiến','Phạm Văn Hải','Tăng Tiến Mạnh','Trần Thanh Sơn','Võ Minh Quyền','Vũ Văn Chính'];
}
function saveNames_(input) {
  if (!Array.isArray(input)) return { ok: false, error: 'INVALID_NAMES' };
  const seen = {};
  const names = [];
  input.forEach(function(v) {
    const name = String(v || '').trim().replace(/\s+/g, ' ');
    if (!name || name.length > 100) return;
    const key = name.toLocaleLowerCase('vi');
    if (!seen[key]) { seen[key] = true; names.push(name); }
  });
  if (names.length > 200) return { ok: false, error: 'TOO_MANY_NAMES' };
  names.sort(function(a,b){ return a.localeCompare(b, 'vi'); });
  PropertiesService.getScriptProperties().setProperty(PTI_GDV_KEY, JSON.stringify(names));
  return { ok: true, names: names };
}
function sha256Hex_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map(function(b){ return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
}
function constantTimeEqual_(a,b) {
  if (a.length !== b.length) return false;
  var diff = 0; for (var i=0;i<a.length;i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
