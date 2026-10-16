# Avec Jo trên Firebase Hosting

Project: `avecjo-cms`, chọn sẵn trong `.firebaserc`. Website và CMS đã được triển khai lên <https://avecjo-cms.web.app>; trang quản trị ở <https://avecjo-cms.web.app/admin>. Project được tạo không liên kết tài khoản thanh toán.

Đăng nhập GitHub cho CMS cần cấu hình OAuth App và Firebase Authentication một lần. Xem [docs/CMS-FIREBASE.md](docs/CMS-FIREBASE.md) để biết thông số, quyền người soạn, quy trình duyệt bài và cách kiểm tra bằng hai tài khoản.

## Nguồn nội dung và đồng bộ GitHub

Mỗi bài nằm trong `content/posts/<slug>.json`; nội dung chung nằm trong `data/content.json`, cấu hình SEO chung trong `data/seo.json`. CMS đọc và ghi các file nguồn qua GitHub. Sau khi cập nhật CMS lần đầu, cần commit và push toàn bộ bản cập nhật từ GitHub Desktop trước khi CMS có thể đọc đủ 28 bài.

Trước khi sửa trên máy, Fetch/Pull các commit mới từ CMS. Không sửa HTML đã sinh rồi trông chờ lần build sau giữ lại thay đổi.

## Deploy các cập nhật

Trong thư mục repo, dùng Node.js 20+ và chạy:

```sh
npm run build
npm run check
npx -y firebase-tools@latest deploy --only hosting --project avecjo-cms
```

Nếu CLI chưa đăng nhập, chạy `npx -y firebase-tools@latest login` bằng tài khoản quản lý project. Với môi trường không mở được trình duyệt cục bộ, dùng `npx -y firebase-tools@latest login --no-localhost`.

Không khởi tạo lại Hosting vì `firebase.json` được bộ build tạo để giữ URL cũ, redirect và alias ảnh. Website có nhiều trang; không thêm rewrite toàn bộ URL về trang chủ.

Push GitHub chỉ kích hoạt các host đã cấu hình tự deploy. Firebase Hosting hiện deploy bằng CLI; repo chưa bật workflow deploy Firebase tự động. Nếu thiết lập GitHub Actions sau này, workflow phải chạy build và kiểm tra trước khi deploy.

## Kiểm tra sau deploy

- Mở `/`, `/blog`, `/photo`, `/contact`, `/sitemap.xml` và một bài đã xuất bản.
- Mở `/admin` và đăng nhập GitHub sau khi đã bật provider.
- Thử redirect cũ `/hanoi-en-1-jour` và alias ảnh `/datafiles/88364/upload/images/vietnam/hanoi/29-que-faire-a-hanoi.jpg`.
- Form Contact chuẩn bị e-mail để khách tự gửi qua ứng dụng mail; website không tự gửi hoặc lưu lời nhắn.

Các URL CMS đã được kiểm tra HTTP trên Hosting. Luồng lưu nháp/gửi duyệt/xuất bản thật cần kiểm tra sau khi cấu hình GitHub provider và push nguồn CMS lên repo.

## Tên miền riêng

Nếu muốn đưa tên miền riêng sang Firebase, vào Hosting → Add custom domain và dùng đúng các bản ghi DNS Firebase cấp. Canonical website hiện giữ `https://www.guidehanoi.com`. Cấu hình GitHub OAuth đang dùng domain `avecjo-cms.web.app` cho trang quản trị.

## Tài liệu chính thức

- [Firebase Hosting](https://firebase.google.com/docs/hosting/quickstart)
- [Cấu hình Hosting](https://firebase.google.com/docs/hosting/full-config)
- [Đăng nhập GitHub](https://firebase.google.com/docs/auth/web/github-auth)
- [Tích hợp GitHub Actions](https://firebase.google.com/docs/hosting/github-integration)
