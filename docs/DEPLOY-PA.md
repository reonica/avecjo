# Cài Avec Jo trên PA

CMS dùng **file trên hosting**, không bắt buộc có MySQL. Chỉ bật MySQL khi cần lưu và quản lý form khách. Hiện chưa có hosting PA thật nên API PHP chưa được cài trên một máy chủ sản xuất.

## Cài CMS trước, chưa cần database

Cần PHP 8.1+ (nên dùng 8.3+), Fileinfo, hỗ trợ `getimagesize`, HTTPS và Apache `mod_rewrite`/`mod_headers`. Thư mục kho CMS cần được PHP ghi, nhưng phải nằm ngoài document root. PDO MySQL chỉ cần khi bật liên hệ.

1. Trên Mac chạy `npm run package:pa`; giải nén gói trong `releases/`.
2. Đưa nội dung `public_html/` lên document root. Đưa `private-setup/` ra ngoài vùng web, ví dụ `~/avecjo-setup/`. Installer và seed **không đưa vào public_html**.
3. Copy `config.example.php` thành `~/avecjo-config.php`, ngoài document root. Điền `cmsDataDir` thành đường dẫn tuyệt đối đến thư mục riêng, ví dụ `/home/username/avecjo-data`. Để trống `dsn`, `username`, `password` MySQL.
4. Tạo `appKey`:

   ```sh
   php -r 'echo bin2hex(random_bytes(32)), PHP_EOL;'
   ```

   Ghi kết quả vào file cấu hình riêng tư; đặt quyền file `600`. Không gửi hoặc commit file cấu hình.
5. Cài bằng SSH, truyền đúng document root ở tham số cuối để installer kiểm tra kho dữ liệu nằm ngoài web:

   ```sh
   php ~/avecjo-setup/install.php ~/avecjo-config.php ~/public_html
   ```

   Installer hỏi ID, email, tên và mật khẩu admin gốc, rồi nhập nội dung ban đầu từ seed vào kho file riêng. Mật khẩu không hiện trên màn hình. Chạy lại không ghi đè tài khoản hoặc nội dung đã có. Nếu gói hosting không có SSH, nhờ PA chạy lệnh CLI này; không tạo endpoint installer công khai.
6. API tại `public_html/backend/api/` mặc định tìm config ở cấp thư mục ngoài `public_html`. Với cấu trúc domain khác, đặt biến môi trường PHP `AVECJO_CONFIG` thành đường dẫn tuyệt đối đến file config. API từ chối cấu hình/kho CMS nằm trong document root.
7. Bổ sung origin HTTPS thực tế vào `allowedOrigins`, không dùng `*`.
8. Sửa source `web/runtime-config.json` trên Mac:

   ```json
   {
     "apiBaseUrl": "https://YOUR-PA-DOMAIN/backend/api/index.php",
     "contactEnabled": false
   }
   ```

   Thay bằng URL thật rồi build/deploy. API có thể nằm trên PA trong khi web và `/backend` vẫn ở Firebase. Địa chỉ API không phải thông tin bí mật; mật khẩu database/app key không được đặt trong runtime-config.json.
9. Mở `/backend` và đăng nhập bằng ID hoặc email/Gmail + mật khẩu CMS. CMS quản lý bài, trang, FAQ, ảnh, SEO và tài khoản mà **không cần MySQL**.

## Phân quyền

**Admin** toàn quyền. Vào Quản trị viên → Tạo tài khoản, chọn **Mod** và các quyền cần cấp. Mặc định mod chỉ biên tập và quản lý ảnh; muốn duyệt, SEO hoặc đọc dữ liệu khách phải cấp riêng. Mod không được quản lý tài khoản. Khóa hoặc đổi quyền sẽ thu hồi các phiên cũ.

Mật khẩu được băm, phiên lưu dạng token hash. Kho `avecjo-data/` chứa dữ liệu riêng, cần backup cùng ảnh. File `state.backup.json` chỉ giữ trạng thái liền trước; không thay thế sao lưu định kỳ.

## Thêm MySQL khi cần nhận form

1. Tạo database/user MySQL riêng; bật PDO MySQL.
2. Điền DSN/user/password vào **file config riêng ngoài web**. DSN ví dụ: `mysql:host=localhost;port=3306;dbname=avecjo;charset=utf8mb4`.
3. Chạy lại installer để tạo bảng `leads` hoặc nhập `private-setup/schema.sql` qua phpMyAdmin. Nội dung và tài khoản vẫn nằm trong kho file, không chuyển vào MySQL.
4. Sau khi thử gửi form và đọc được dữ liệu trong CMS, đổi `contactEnabled` thành `true` trong source runtime-config rồi build/deploy.

Khi MySQL chưa có, CMS vẫn đăng nhập và lưu nội dung bình thường. Form công khai tiếp tục chuẩn bị email để khách tự gửi nếu nhận form trực tuyến chưa bật. API không báo đã nhận thành công khi chưa ghi được dữ liệu khách vào MySQL.

## Đồng bộ và deploy

Lưu trong CMS ghi file trên hosting ngay. Mod có thể gửi duyệt; admin duyệt bản sẽ xuất ra web. Trên Mac:

```sh
npm run cms:sync
npm run build
npm run check
```

Sync hỏi ID/email và mật khẩu trong terminal, chỉ lấy nội dung đã duyệt và ảnh. Không kéo tài khoản, phiên, password hash hoặc email khách về repo. Source trước đồng bộ được giữ trong `.cms-backups/`.

Deploy PA bằng terminal:

```sh
PA_SSH_TARGET=username@host PA_WEB_ROOT=/home/username/public_html bash tools/deploy-pa.sh
```

Đầu tiên là dry-run. Kiểm tra rồi thêm `--apply` để upload. Script không xóa file máy chủ hoặc kho dữ liệu riêng. Khi xóa URL đã công khai, cần redirect và dọn HTML cũ phù hợp.

Deploy Firebase:

```sh
npm run build
npm run check
npx firebase-tools deploy --only hosting:main --project avec-jo
```

Firebase chỉ giữ giao diện và HTML/ảnh công khai; API PHP và kho file hoạt động trên PA. Không có đường tắt `?demo=1` trên production. Demo và dữ liệu seed chỉ được server local phục vụ trên `127.0.0.1`.

## Kiểm tra khi kích hoạt hosting

- Chưa đăng nhập, `/backend`, `#posts`, `#admins` chỉ hiện form; API overview/content/export trả 401.
- Đăng nhập ID và email, lưu bài, tạo mod, tải ảnh khi DSN vẫn trống: phải hoạt động.
- Mod lưu/gửi duyệt nhưng không duyệt, xem liên hệ hoặc quản lý tài khoản nếu chưa được cấp quyền.
- Khóa mod: token cũ bị từ chối ngay.
- Nguồn kho CMS, config, backup và seed không truy cập được bằng URL công khai.
- Khi bật liên hệ, gửi form thử và xác nhận bản ghi MySQL trước khi công bố nhận trực tuyến.

Các kiểm thử API đã chạy trong PHP 8.3 với kho file riêng, không có MySQL. Cần kiểm tra thêm quyền thư mục, HTTPS và kết nối MySQL thật khi PA được cấp.

## Đổi từ avec-jo.web.app sang guidehanoi.com

Tài khoản không gắn với tên miền của giao diện. Giữ cùng API/kho file thì ID, email/Gmail, password hash và quyền admin/mod vẫn giữ nguyên. Không phải tạo lại tài khoản.

- Nếu chỉ đổi domain website, giữ nguyên API và `cmsDataDir`. Cập nhật URL API nếu cần; cấu hình mẫu đã liệt kê `https://guidehanoi.com` và `https://www.guidehanoi.com` trong `allowedOrigins`.
- Nếu chuyển cả API sang hosting khác, phải chuyển **kho file riêng ngoài public**, file cấu hình riêng và ảnh upload. Chỉ chép `dist/` sẽ không mang tài khoản, bản nháp hoặc quyền theo.
- Sau khi xác nhận domain mới, build/deploy runtime config trỏ đúng API và giữ canonical phù hợp với tên miền chính đã chọn.
- Phiên trên web.app không tự chuyển sang domain mới do bộ nhớ trình duyệt tách theo origin. Người dùng đăng nhập lại bằng cùng ID/email và mật khẩu.
- Khi dùng đồng thời domain có và không có `www`, nên chọn một domain chính và redirect domain còn lại để tránh phải đăng nhập ở hai origin riêng.
