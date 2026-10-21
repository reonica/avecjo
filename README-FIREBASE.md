# Avec Jo trên Firebase Hosting

Repo dùng cho hai project Firebase riêng:

| Nội dung | Project | Địa chỉ |
| --- | --- | --- |
| Website Avec Jo và các tour | `avec-jo` | <https://avec-jo.web.app> |
| Bản website/CMS riêng | `avecjo-cms` | <https://avecjo-cms.web.app> |

`.firebaserc` vẫn mặc định là `avecjo-cms`. Các lệnh và workflow dành cho website Avec Jo luôn chỉ rõ `--project avec-jo` hoặc `projectId: avec-jo`. Trang quản trị của bản CMS riêng ở <https://avecjo-cms.web.app/admin>.

Đăng nhập GitHub cho CMS cần cấu hình OAuth App và Firebase Authentication một lần. Xem [docs/CMS-FIREBASE.md](docs/CMS-FIREBASE.md) để biết thông số, quyền người soạn, quy trình duyệt bài và cách kiểm tra bằng hai tài khoản.

## Nguồn nội dung và đồng bộ GitHub

Mỗi bài nằm trong `content/posts/<slug>.json`; nội dung chung nằm trong `data/content.json`, cấu hình SEO chung trong `data/seo.json`. CMS đọc và ghi các file nguồn qua GitHub. Sau khi cập nhật CMS lần đầu, cần commit và push toàn bộ bản cập nhật từ GitHub Desktop trước khi CMS có thể đọc đủ 28 bài.

Trước khi sửa trên máy, Fetch/Pull các commit mới từ CMS. Không sửa HTML đã sinh rồi trông chờ lần build sau giữ lại thay đổi.

## Deploy các cập nhật

Trên Cloud Shell, nếu repo đã clone tại `~/avecjo`, chạy:

```sh
cd ~/avecjo &&
git stash push -m "cloudshell-reports-before-update" -- migration/build-manifest.json migration/seo-validation.json migration/validation.json &&
git switch main &&
git pull --ff-only origin main &&
npm run build &&
npm run check &&
FIREBASE_HOSTING_UPLOAD_CONCURRENCY=3 npx -y firebase-tools@latest deploy --only hosting --project avec-jo
```

Lệnh stash chỉ cất ba báo cáo tự sinh để chúng không chặn pull. Không cần khôi phục chúng vì build/check sẽ tạo lại. Chuỗi lệnh dừng trước deploy nếu pull, build hoặc kiểm tra thất bại. Giới hạn ba lượt upload đồng thời phù hợp với lỗi kết nối Cloud Shell đã gặp trước đây.

Nếu cần đăng nhập lại trên Cloud Shell, chạy `npx -y firebase-tools@latest login --reauth --no-localhost` bằng tài khoản quản lý project. Mở link mới mà lệnh cung cấp và dán mã xác thực từ trình duyệt vào dòng `Enter authorization code`; mã phiên ngắn không phải mã xác thực.

Chỉ dùng `--project avecjo-cms` khi chủ ý cập nhật bản website/CMS riêng.

Không khởi tạo lại Hosting vì `firebase.json` được bộ build tạo để giữ URL cũ, redirect và alias ảnh. Website có nhiều trang; không thêm rewrite toàn bộ URL về trang chủ.

## Tự deploy sau Push origin — thiết lập một lần

Workflow `.github/workflows/firebase-hosting-merge.yml` triển khai Hosting `avec-jo` sau mỗi push lên `main`, đồng thời cho phép chạy thủ công từ GitHub Actions. Workflow dùng Node.js 22, chạy build và kiểm tra trước khi deploy, giới hạn upload đồng thời và xếp hàng các lần deploy. Cần hoàn tất kết nối tài khoản dưới đây và push file workflow lên GitHub trước khi quy trình này hoạt động.

Chạy bước kết nối trên máy Mac: GitHub Desktop → chọn repo `avecjo` → Repository → Open in Terminal. Máy hiện có Node.js và npx tại `/usr/local/bin`; wizard không cần bạn cài Git CLI để push vì phần push vẫn làm trong GitHub Desktop.

Trong Terminal vừa mở, chạy:

```sh
npx -y firebase-tools@latest login &&
npx -y firebase-tools@latest init hosting:github --project avec-jo
```

Phần đăng nhập GitHub của wizard dùng callback localhost, vì vậy chạy nó trên máy Mac đang mở trình duyệt. Lệnh `login --no-localhost` dành cho đăng nhập Google từ Cloud Shell không thay đổi callback GitHub này. Deploy thủ công vẫn chạy trên Cloud Shell theo phần trên.

Đăng nhập GitHub theo hướng dẫn của CLI bằng tài khoản có quyền quản trị repo. Khi được hỏi, chọn:

| Câu hỏi | Giá trị |
| --- | --- |
| GitHub repository | `reonica/avecjo` |
| Chạy build trước deploy | Yes |
| Build command | `npm run build && npm run check` |
| Tự deploy lên live channel | Yes |
| Live branch | `main` |
| Ghi đè workflow có sẵn nếu được hỏi | No |

CLI tạo tài khoản triển khai trong project và lưu khóa đã mã hóa vào GitHub Actions secret `FIREBASE_SERVICE_ACCOUNT_AVEC_JO`. Kiểm tra tên secret tại <https://github.com/reonica/avecjo/settings/secrets/actions>; không cần sao chép khóa hoặc đưa khóa vào mã nguồn.

File workflow live đã được chuẩn bị trong repo trên máy Mac và tham chiếu đúng secret này. Sau khi CLI báo thiết lập xong, mở GitHub Desktop, chọn repo `avecjo`, nhánh `main`, rồi Push origin. Không cần commit thêm file preview `firebase-hosting-pull-request.yml` do wizard sinh; cấu hình hiện tại chỉ cần workflow live đã chuẩn bị.

Theo dõi workflow tại <https://github.com/reonica/avecjo/actions>. Khi job deploy thành công, kiểm tra <https://avec-jo.web.app/circuits>. Sau bước kết nối một lần này, các lần sau chỉ cần commit và Push origin trên `main`; Vercel và Firebase chạy các pipeline triển khai riêng.

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
