# Avec Jo — bàn giao chạy thử trên hosting PA

Gói gồm website, CMS `/backend`, API PHP, nội dung nguồn và công cụ build. Dùng domain/subdomain thử của PA có HTTPS trước; chưa cần chuyển DNS của guidehanoi.com và chưa cần MySQL để quản trị nội dung.

## 1. Nội dung gói ZIP

- `public_html/`: bản đã build, có thể upload ngay; gồm web, CMS, ảnh/font và API PHP.
- `private-setup/`: installer, cấu hình mẫu và seed nội dung ban đầu. Phải đặt **ngoài vùng web công khai**.
- `source/`: mã nguồn đầy đủ để chỉnh sửa và build lại trên Mac/máy có Node.js. Không có `.git`, dependency cache, tài khoản thật hoặc thông tin kết nối bí mật.
- `SOURCE-REVISION.txt`: commit nguồn dùng để đóng gói.

Không upload toàn bộ gói vào public_html. Không đưa `source/`, `private-setup/`, config hoặc kho tài khoản vào document root.

## 2. Yêu cầu máy chủ

- PHP 8.1+; nên chọn PHP 8.3 trở lên. Bật Fileinfo và hỗ trợ `getimagesize`.
- Apache/LiteSpeed tương thích `.htaccess`, `mod_rewrite`, `mod_headers`.
- Domain thử có HTTPS hợp lệ.
- PHP có quyền tạo/ghi kho file riêng ngoài document root và `assets/images/` cho ảnh upload.
- Có SSH/Terminal để chạy installer. Nếu gói không có Terminal, nhờ PA chạy lệnh CLI bên dưới; không mở installer công khai qua trình duyệt.
- MySQL/PDO MySQL chỉ cần khi bật lưu contact form.

## 3. Upload và cài đặt

1. Tạo domain thử trên hosting PA, cấp SSL và mở thử URL HTTPS. Chưa chuyển domain guidehanoi.com.
2. Chép **nội dung** thư mục `public_html/` trong gói vào document root thật của domain thử; giữ file ẩn `.htaccess`. Không tạo thêm một tầng `public_html/public_html`.
3. Xác định thư mục cha ngay bên ngoài document root thật. Đặt `private-setup/` vào đó và đổi tên thành `avecjo-setup/`.
4. Copy `avecjo-setup/config.example.php` thành `avecjo-config.php` ở thư mục cha đó. Điền:
   - `cmsDataDir`: đường dẫn tuyệt đối đến thư mục riêng, ví dụ `/home/USER/domains/TEST/avecjo-data`.
   - `appKey`: tạo bằng `php -r 'echo bin2hex(random_bytes(32)), PHP_EOL;'` và dán kết quả.
   - `allowedOrigins`: thêm đúng origin HTTPS của domain thử, ví dụ `https://test.example.com`; giữ các domain Avec Jo/guidehanoi đã có.
   - Để trống `dsn`, `username`, `password` khi chưa dùng MySQL.
5. Đặt quyền file cấu hình `600`. Kho dữ liệu riêng được installer tạo với quyền thư mục `700`, file `600`.
6. Trong terminal, chuyển vào **document root thật**, rồi chạy:

   ```sh
   php ../avecjo-setup/install.php ../avecjo-config.php "$(pwd)"
   ```

   Lệnh hỏi ID admin, email/Gmail, tên hiển thị, mật khẩu tối thiểu 12 ký tự và nhập lại mật khẩu. Mật khẩu không hiện ra màn hình và chỉ được lưu dạng hash. Gói không có tài khoản/mật khẩu mặc định.

Với cấu trúc trên, API tự tìm `../avecjo-config.php` ở ngoài document root. Nếu muốn đặt config ở nơi khác, khai báo biến môi trường PHP `AVECJO_CONFIG` thành đường dẫn tuyệt đối. API từ chối config/kho CMS trong vùng công khai.

## 4. Kiểm tra CMS

Bản `public_html/runtime-config.json` trong gói đã đặt:

```json
{
  "apiBaseUrl": "/backend/api/index.php",
  "contactEnabled": false
}
```

Vì vậy domain thử gọi API PHP của chính hosting PA. Bản source trong `source/web/runtime-config.json` vẫn giữ cấu hình Firebase; khi tự build lại cho PA, đặt URL API phù hợp trước khi upload.

Kiểm tra theo thứ tự:

1. Mở `https://DOMAIN-THU/backend/api/index.php?route=health`: nhận `ok: true`, `storage: files`, `contactsConfigured: false` khi chưa có MySQL.
2. Mở `/backend` khi chưa đăng nhập: chỉ thấy form, không thấy dashboard hoặc danh sách bài.
3. Đăng nhập bằng ID và sau đó bằng email/Gmail vừa tạo. Không dùng mật khẩu Google; đây là mật khẩu CMS riêng.
4. Vào Quản trị viên để tạo mod. Mod mặc định chỉ biên tập/ảnh; thử truy cập tài khoản hoặc email khách khi chưa có quyền phải bị từ chối.
5. Sửa một bài thử, lưu nháp và mở lại; thử upload ảnh, chỉnh FAQ, SEO, trang/landing page.
6. Khóa mod rồi kiểm tra phiên cũ bị thu hồi.
7. Đảm bảo config, seed, kho JSON, backup, tài khoản không truy cập được bằng URL web.

CMS lưu nội dung, tài khoản, phiên và quyền bằng file riêng trên hosting, **không cần MySQL**. Contact form vẫn chuẩn bị email để khách tự gửi khi nhận trực tuyến chưa bật.

## 5. Lưu nội dung và xuất bản

Lưu nháp/duyệt trong CMS cập nhật kho file hosting. Bản HTML công khai chưa tự build ngay. Để xuất bản, trên máy có source/Node:

```sh
npm run cms:sync
npm run build
npm run check
```

`source/web/runtime-config.json` cần trỏ đến URL API PA thực tế khi chạy sync, ví dụ `https://DOMAIN-THU/backend/api/index.php`. Sync hỏi ID/email và mật khẩu admin, chỉ lấy nội dung đã duyệt và ảnh, không lấy tài khoản hoặc dữ liệu khách.

Sau đó upload bản `dist/` hoặc dùng `tools/deploy-pa.sh`. Không cần Node.js trên hosting để chạy web/CMS đã build. Không ghi đè hoặc xóa kho `avecjo-data/` khi cập nhật mã.

## 6. Bổ sung MySQL sau

Khi cần nhận dữ liệu khách: tạo database/user MySQL riêng; bật PDO MySQL; điền DSN/user/password vào config riêng tư; chạy lại installer hoặc nhập `private-setup/schema.sql` để tạo bảng leads. Sau khi kiểm thử INSERT/đọc dữ liệu thành công, đặt `contactEnabled: true` trong runtime config. Nội dung và tài khoản không chuyển vào MySQL.

## 7. Chuyển về guidehanoi.com sau khi thử xong

- Giữ nguyên kho file riêng, tài khoản, quyền và ảnh upload. Nếu đổi cả tài khoản hosting/document root, chuyển chúng sang vị trí riêng tương ứng và cập nhật config.
- Cấp SSL cho guidehanoi.com/www; chọn domain chính và redirect domain còn lại.
- Cập nhật `allowedOrigins` và URL API nếu cần. Bản trong gói dùng URL API tương đối nên đi theo origin hiện tại khi web/API cùng hosting.
- Canonical của nội dung hiện là `https://www.guidehanoi.com`; chỉ đổi nếu chọn domain chính khác.
- Người dùng đăng nhập lại trên domain mới bằng cùng ID/email và mật khẩu; không phải tạo lại tài khoản.

## 8. Sao lưu

Sao lưu toàn bộ `avecjo-data/`, cấu hình riêng và ảnh upload. `state.backup.json` chỉ giữ một trạng thái liền trước, không thay thế backup định kỳ. Nếu đã dùng MySQL, sao lưu thêm database leads. Không gửi các file chứa tài khoản/password hash/token hash hoặc dữ liệu khách vào GitHub.
