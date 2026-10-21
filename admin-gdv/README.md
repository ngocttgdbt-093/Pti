# PTI — Quản trị danh sách GĐV (độc lập)

Gói này là phần backend riêng cho danh sách GĐV. Nó không truy cập Drive, không lưu hồ sơ/ảnh, không sửa API của 093.

## Triển khai backend
1. Tạo một Google Apps Script project mới, đặt tên `PTI_GDV_ADMIN_API`. Không dùng dự án `PTI093_DATA_API`.
2. Sao chép `PTI_GDV_ADMIN_API.gs` vào `Code.gs`.
3. Tạo mật khẩu quản trị mới. Trong Project Settings → Script Properties, thêm:
   - Key: `ADMIN_PASSWORD_HASH`
   - Value: SHA-256 dạng hex của mật khẩu (chữ thường).
   Không đặt mật khẩu thô trong mã nguồn hay repository.
4. Deploy → New deployment → Web app; Execute as: Me; Who has access: Anyone. Sao chép URL kết thúc bằng `/exec`.
5. Giao diện PTI phải được cấu hình dùng URL này; không điền URL của API 093.

## Giao thức API
POST JSON, Content-Type `text/plain;charset=utf-8`:
- `{"action":"login","username":"Administrator","password":"..."}`
- `{"action":"list","token":"..."}`
- `{"action":"save","token":"...","names":["Tên A","Tên B"]}`
- `{"action":"logout","token":"..."}`

Token hết hạn sau 6 giờ. Danh sách lưu trong Script Properties của project độc lập.
