# Deploy Avec Jo lên Firebase Hosting

Repository đã kiểm tra: https://github.com/reonica/avecjo (branch `main`). Website là HTML/CSS/JavaScript tĩnh, dùng Firebase Hosting. Không cần chạy build để deploy các HTML đã xuất.

## 1. Upload gói cập nhật

Giải nén `avecjo-firebase-update.zip`. Trong repo GitHub, chọn **Add file → Upload files**, đưa toàn bộ nội dung bên trong vào gốc repo, giữ nguyên các thư mục `contact/`, `merci/`, `tools/`, `migration/`. Commit lên branch `main`. Không upload riêng file ZIP.

Gói bổ sung `firebase.json`, chuyển form Contact sang chuẩn bị e-mail, và cập nhật bộ build/kiểm tra để lần sửa bài sau vẫn tạo được cấu hình Firebase. Giao diện, bài viết và ảnh được giữ.

`netlify.toml` và `_redirects` có thể để lại trong repo: Firebase không dùng chúng và cấu hình mới loại chúng khỏi thư mục public khi deploy.

## 2. Tạo project Firebase

Mở https://console.firebase.google.com/ bằng tài khoản Google bạn muốn quản lý website. Tạo project, đặt tên hiển thị **Avec Jo**. Ghi lại **Project ID** trong Project settings → General; ID này có thể khác tên hiển thị và tên repo GitHub. Google Analytics là tùy chọn.

Nếu đã có project đúng cho website, dùng project đó. Phần Hosting tĩnh này không cần tạo Firestore, đăng ký Web App, hay đưa Firebase SDK/API key vào các trang.

## 3. Deploy bằng Cloud Shell trong trình duyệt

Mở https://shell.cloud.google.com/ và đăng nhập cùng tài khoản Google. Cloud Shell đã có Firebase CLI. Chạy lần lượt:

```sh
git clone https://github.com/reonica/avecjo.git
cd avecjo
firebase projects:list
```

Sau đó thay `PROJECT_ID_CUA_BAN` bên dưới bằng Project ID thực, rồi chạy:

```sh
firebase deploy --only hosting --project PROJECT_ID_CUA_BAN
```

Khi Cloud Shell hỏi cấp quyền truy cập Google Cloud cho thao tác này, chọn Authorize. Nếu CLI yêu cầu đăng nhập riêng, chạy `firebase login --no-localhost` và làm theo hướng dẫn trên màn hình.

Không cần chạy `firebase init hosting` vì gói đã có cấu hình hoàn chỉnh. Chạy init lần nữa có thể ghi đè phần cấu hình giữ URL. Không thêm rewrite `** → /index.html`: website có nhiều trang thật và cần trả 404 cho đường dẫn không tồn tại.

Kết thúc thành công, CLI in **Hosting URL**. Mở URL đó để kiểm tra. Project thường có URL `<PROJECT_ID>.web.app` và `<PROJECT_ID>.firebaseapp.com`.

## 4. Kiểm tra trước khi chuyển tên miền

Trên URL Firebase, mở Home, `/blog`, `/photo`, `/contact`, `/sitemap`, `/sitemap.xml`, `/que-faire-a-hanoi-vietnam` và `/blog?keyword=Que%20faire%20%C3%A0%20Hanoi` (tag gốc có 7 bài). Kiểm tra menu mobile, carousel, ảnh và footer.

Kiểm tra `/hanoi-en-1-jour` chuyển về Home như site cũ. Một URL ảnh cũ để thử:

```text
/datafiles/88364/upload/images/vietnam/hanoi/29-que-faire-a-hanoi.jpg
```

Form Contact có nút **Préparer mon e-mail**. Điền form và bấm nút để tạo liên kết mở e-mail có nội dung sẵn. Khách cần mở ứng dụng mail và tự bấm gửi; website không tự gửi e-mail hay lưu lời nhắn. WhatsApp vẫn hoạt động qua liên kết trực tiếp.

## 5. Chuyển domain sau khi kiểm tra

Trong Firebase Console, vào **Hosting → Add custom domain**, thêm `www.guidehanoi.com` và làm các bước xác minh/DNS Firebase đưa ra. Thêm `guidehanoi.com` và chọn chuyển hướng về `www.guidehanoi.com` để khớp canonical gốc.

Dùng chính các bản ghi Firebase cấp cho project, không lấy IP hoặc bản ghi minh họa từ nơi khác. Chờ trạng thái domain/HTTPS sẵn sàng rồi kiểm tra lại các URL cũ trên tên miền thật.

## Deploy các cập nhật tiếp theo

Khi code mới đã lên GitHub, trong Cloud Shell đang ở thư mục `avecjo`:

```sh
git pull origin main
firebase deploy --only hosting --project PROJECT_ID_CUA_BAN
```

Cách trên deploy thủ công; push lên GitHub tự nó chưa deploy Firebase.

Để thiết lập tự động qua GitHub Actions sau khi lần deploy đầu đã chạy tốt, chọn project và khởi tạo riêng tích hợp GitHub:

```sh
firebase use --add
firebase init hosting:github
```

Chọn project đã dùng, alias `default`, repository `reonica/avecjo`. Không cần bước build trước deploy vì repo có HTML sẵn. Nếu muốn tự deploy live khi cập nhật branch chính, bật tùy chọn đó và chọn `main`. CLI tạo workflow và GitHub secret cần thiết; đưa các workflow được tạo vào repo bằng commit/PR. Làm theo thông báo CLI nếu cần đăng nhập GitHub.

## Cập nhật nội dung

Nếu sửa `data/content.json`, chạy hai lệnh sau trước khi commit HTML và cấu hình mới (Node.js 20+):

```sh
node tools/build.mjs
node tools/validate.mjs
```

`firebase.json` giữ 14 redirect cho 7 URL cũ và 204 rewrite cho trang/ảnh. `trailingSlash: false` giữ định dạng không có dấu `/` cuối như URL cũ. Trang lỗi dùng `404.html`, không bị chuyển thành Home.

## Tài liệu chính thức

- https://firebase.google.com/docs/hosting/quickstart
- https://firebase.google.com/docs/hosting/full-config
- https://firebase.google.com/docs/cli
- https://firebase.google.com/docs/hosting/github-integration
- https://firebase.google.com/docs/hosting/custom-domain

Đã kiểm tra tĩnh cấu hình/đường dẫn và thử form e-mail trên máy. Chưa deploy vào tài khoản Firebase của bạn và chưa đổi DNS; cần kiểm tra trên URL Hosting thật sau khi deploy.
