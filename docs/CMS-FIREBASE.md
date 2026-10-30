# CMS tại /backend

Trang chưa đăng nhập chỉ hiện form ID hoặc email/Gmail + mật khẩu. Dashboard, danh sách nội dung và quản lý tài khoản được API kiểm tra phiên/quyền trước khi trả dữ liệu. Bản demo chỉ chạy trên localhost, không bật bằng query string trên production.

CMS dùng file riêng trên hosting cho nội dung, tài khoản và phiên; ảnh là file trong assets. MySQL chỉ dùng cho dữ liệu form khách. Xem [DEPLOY-PA.md](DEPLOY-PA.md).

Firebase Hosting hiện tại chỉ phục vụ giao diện, HTML và ảnh đã deploy. Cần API PHP (ví dụ trên PA) để đăng nhập thật và ghi file; không cần MySQL cho các module nội dung. Seed và dữ liệu tổng hợp CMS không nằm trong public build.
