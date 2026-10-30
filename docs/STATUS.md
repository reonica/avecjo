# Trạng thái triển khai

Cập nhật ngày 30/10/2026:

- https://avec-jo.web.app/backend hiện chỉ hiển thị trang đăng nhập khi chưa xác thực. Dashboard và các module được ẩn ngay từ HTML ban đầu; nội dung riêng chỉ được API trả sau khi kiểm tra phiên/quyền.
- `?demo=1` không mở khóa CMS trên production. Demo chỉ chạy trên localhost qua server phát triển.
- `seed.json`, `manifest.json`, `demo-data.json` của CMS không nằm trong public build. Dữ liệu seed để cài hosting chỉ nằm trong `private-setup/` của gói PA.
- CMS đã đổi sang **kho file riêng ngoài document root** cho bài viết/trang/FAQ/SEO, tài khoản admin/mod, phiên và audit. Ảnh là file trên hosting. MySQL chỉ phục vụ form/email khách.
- CMS có thể đăng nhập, tạo mod, lưu nháp, duyệt và export khi MySQL chưa cấu hình. Đã kiểm thử bằng API thật trong PHP 8.3 với DSN trống.
- Lưu trong CMS cập nhật file hosting. Bản đã duyệt được `cms:sync` lấy về repo; build/deploy tiếp tục tạo HTML công khai, sitemap và metadata. Chưa có tự động chạy Node build trên PA.
- Chưa có PA/máy chủ PHP sản xuất: bản Firebase hiện tại mới có trang đăng nhập; chưa có tài khoản thật hoặc API ghi file được kích hoạt trên hosting. MySQL không phải điều kiện cho CMS, nhưng máy chủ xác thực/ghi file vẫn cần.
- 29/29 kiểm thử Node đạt; kiểm tra 170 trang HTML, 8.328 tham chiếu nội bộ, 28/28 nội dung bài gốc và SEO đạt.
- 16/16 kiểm thử bảo mật PHP và 33/33 kiểm thử API đầu cuối đạt, gồm đăng nhập ID/email, lưu bằng file, nháp/duyệt, chặn mod nâng quyền và thu hồi phiên. Chưa kiểm thử kết nối MySQL PA thật.
- Site `avecjo-cms` vẫn ngừng phục vụ; 3 bản Hosting cũ đã xóa. Không xóa project Google Cloud.
- Tài khoản độc lập với domain giao diện. Khi đổi sang guidehanoi.com, giữ nguyên API/kho file thì vẫn dùng cùng ID/email và mật khẩu; cần đăng nhập lại trên origin mới.
- Backend dùng logo, ảnh hero, palette xanh/cam đất và font Newsreader/Inter từ web chính. Palette CMS được trích trực tiếp từ :root của CSS web chính khi build.
- Gói bàn giao PA đầy đủ có public_html/, private-setup/, source/ và SOURCE-REVISION.txt để đối chiếu commit. Hướng dẫn chạy thử không cần MySQL nằm trong docs/PA-HANDOFF.md. Giao diện production dùng cùng source đã kiểm tra.

Hướng dẫn cài đặt: [DEPLOY-PA.md](DEPLOY-PA.md).
