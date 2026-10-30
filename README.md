# Avec Jo

Một repo cho website công khai, CMS riêng tại `/backend` và API PHP. CMS lưu nội dung bằng file trên hosting; MySQL chỉ dành cho dữ liệu liên hệ khách hàng.

```text
web/        CSS, JS, ảnh và runtime-config.json
cms/        Giao diện đăng nhập và quản trị admin/mod
content/    Nội dung JSON dùng để build HTML
server/     API PHP, kho file riêng, installer, schema liên hệ tùy chọn
data/       Cấu hình nội dung nền, SEO và AIO
tools/      Build, đồng bộ, kiểm tra và đóng gói/deploy
tests/      Kiểm thử nội dung và build
docs/       Hướng dẫn vận hành
dist/       Tự sinh khi build; chỉ thư mục này đưa lên web
```

## Chạy local

```sh
npm run build
npm run check
npm run dev
```

Mở `http://127.0.0.1:8787/backend`. Bản thường luôn yêu cầu đăng nhập trước khi hiển thị dashboard hoặc module. `?demo=1` **chỉ hoạt động trên localhost** để xem dữ liệu minh họa. Production không có đường tắt demo hoặc file seed/danh sách nội dung quản trị công khai. Build không cần `npm install`.

## Nơi lưu dữ liệu

| Loại | Lưu ở đâu |
| --- | --- |
| Bài viết, trang, landing, FAQ, tag/cate, SEO/AIO | File JSON riêng trên hosting, có bản nháp và bản đã duyệt |
| Ảnh | File ảnh trong `assets/images/` |
| Tài khoản admin/mod, password hash, quyền, phiên đăng nhập | Kho file riêng **ngoài document root** |
| Form khách, email, điện thoại, ghi chú chăm sóc | MySQL, chỉ khi bật module liên hệ |

Kho file dùng khóa để tuần tự hóa cập nhật và ghi qua file tạm/rename. Giữ một bản backup riêng của trạng thái trước đó. Kho này không nằm trong `dist/`, không đi cùng bản deploy và không đưa vào Git.

## Tài khoản và quyền

Admin toàn quyền; mod mặc định biên tập và quản lý ảnh, có thể được cấp thêm từng quyền duyệt, SEO hoặc dữ liệu khách. ID hoặc email/Gmail + mật khẩu CMS dùng để đăng nhập; không dùng GitHub hoặc mật khẩu Google. Tài khoản được tạo bằng API sau khi đã có máy chủ PHP, **không cần MySQL**.

API kiểm tra phiên và quyền trước khi trả dashboard, danh sách nội dung, tài khoản hoặc export. Đổi quyền, khóa hoặc đặt lại mật khẩu sẽ thu hồi phiên. Mật khẩu được băm, token phiên chỉ lưu dạng hash tại máy chủ và hết hạn sau 8 giờ.

## Lưu và xuất bản

Chỉnh sửa/lưu nháp từ CMS ghi trực tiếp vào kho file hosting. Duyệt bài giữ một bản riêng để đồng bộ về source. Để tạo lại HTML công khai, sitemap và SEO:

```sh
npm run cms:sync
npm run build
npm run check
```

Sau đó deploy `dist/` lên PA hoặc Firebase. Việc lưu/duyệt không tự chạy Node build trên hosting. Sync chỉ lấy nội dung đã duyệt và ảnh, không lấy tài khoản hoặc dữ liệu khách. Source trước đồng bộ được giữ trong `.cms-backups/` (gitignored).

## Hosting

- Web: https://avec-jo.web.app
- CMS: https://avec-jo.web.app/backend
- Firebase Hosting hiện tại phục vụ file đã deploy; muốn đăng nhập thật hoặc ghi nội dung cần API trên máy chủ PHP, ví dụ PA. Không thể ghi trực tiếp vào bản Firebase Hosting từ trình duyệt nếu chưa có backend.
- Khi có PA, cài CMS/file storage trước, để trống MySQL và tắt nhận form trực tuyến. Bổ sung MySQL sau mà không ảnh hưởng các module nội dung.
- Xem [docs/DEPLOY-PA.md](docs/DEPLOY-PA.md). `npm run package:pa` tạo gói đầy đủ gồm `public_html/`, `private-setup/`, `source/` và hướng dẫn [bàn giao PA](docs/PA-HANDOFF.md). API trong bản upload PA được cấu hình theo cùng origin của domain thử.
- PHP bị loại khỏi upload Firebase; dữ liệu seed ban đầu chỉ có trong `private-setup/`, không được phục vụ trên web.
- Canonical tiếp tục dùng `https://www.guidehanoi.com` theo cấu hình hiện có.

Giữ URL lịch sử hoặc thiết lập redirect trước khi xóa trang. `migration/` giữ dữ liệu đối chiếu và không thuộc deploy.
