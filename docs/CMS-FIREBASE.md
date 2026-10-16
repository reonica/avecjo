# CMS Avec Jo trên Firebase Spark

CMS chạy ở `/admin/` trên Firebase Hosting. Firebase Authentication xử lý đăng nhập GitHub; Decap CMS ghi bài/ảnh vào GitHub. Không dùng Cloud Functions, Firestore hoặc Firebase Storage; không cần nâng cấp Blaze cho kiến trúc này. Firebase/GitHub vẫn áp dụng hạn mức của từng dịch vụ.

## Project AvecJo CMS

- Project ID: `avecjo-cms` (đã chọn trong `.firebaserc`).
- CMS: <https://avecjo-cms.web.app/admin>.
- Web app: `1:577697780369:web:e51dd78d1227d541136530`.
- Homepage URL cho GitHub OAuth App: `https://avecjo-cms.web.app/admin`.
- Authorization callback URL: `https://avecjo-cms.firebaseapp.com/__/auth/handler`.
- Cấu hình provider: <https://console.firebase.google.com/project/avecjo-cms/authentication/providers>.

Chỉ nhập GitHub Client Secret trong Firebase Console. Không commit secret vào repo. Nếu dùng tài khoản Firebase lần đầu, điều khoản Google Cloud và điều khoản Firebase là hai bước riêng; luồng chấp nhận Firebase là <https://console.firebase.google.com/?forceCheckTos=true>.

Sau khi commit và push bản cập nhật CMS lên `main`, kiểm tra CMS đọc đủ 28 bài hiện có. Bản Hosting được deploy từ máy không tự đưa các file nguồn mới lên GitHub; CMS đọc nội dung từ repo trên GitHub.

## Nguồn nội dung duy nhất

- Mỗi bài nằm trong `content/posts/<slug>.json`. CMS và người sửa bằng GitHub Desktop cùng chỉnh các file này.
- `data/content.json` chứa thông tin site, category, album, trang và thứ tự bài gốc; không còn chứa bản sao nội dung bài.
- Các trường SEO của bài nằm cùng file bài: `seoTitle`, `description`, `image`, `imageAlt`. Dữ liệu SEO trang dịch vụ vẫn trong `data/seo.json`.
- Giữ nguyên slug và tên file của các bài đã xuất bản. Build sẽ từ chối slug không hợp lệ hoặc trùng trang khác. Không sửa HTML đã sinh ra vì lần build kế tiếp sẽ tạo lại.
- Khi CMS tạo commit mới: dùng **Fetch origin → Pull origin** trong GitHub Desktop trước khi sửa tiếp. Nếu có xung đột, phải xử lý theo từng thay đổi; không ghi đè cả thư mục bằng bản sao cũ.

## Bật đăng nhập GitHub một lần

1. Giữ project Firebase ở gói **Spark**. Trong **Project settings → General**, thêm/chọn Web app và liên kết Web app đó với Hosting site đang chạy Avec Jo. Endpoint `/__/firebase/init.json` phải trả về cấu hình `projectId`, `apiKey`, `authDomain`.
2. Vào **Authentication → Sign-in method**, bật provider **GitHub**. Firebase hiển thị **Authorization callback URL**. Sao chép nguyên URL này (thường có dạng `https://PROJECT_ID.firebaseapp.com/__/auth/handler`).
3. Trên GitHub, vào **Settings → Developer settings → OAuth Apps → New OAuth App**. Đặt Homepage URL bằng URL Firebase chứa CMS; Authorization callback URL bằng URL Firebase cung cấp ở bước 2.
4. Sao chép Client ID và Client Secret vào phần provider GitHub trong **Firebase Console**, rồi lưu. **Không đưa Client Secret vào repo, CMS config, ảnh chụp hoặc tin nhắn.** CMS chỉ nhận access token của người đang đăng nhập qua Firebase.
5. Trong **Authentication → Settings → Authorized domains**, bảo đảm hostname chạy CMS được cho phép. Bắt đầu bằng domain `PROJECT_ID.web.app` để thử; sau đó mới dùng domain riêng nếu cần.
6. Build và deploy Hosting bằng tài khoản Firebase của bạn:

   ```sh
   npm run build
   npm run check
   npx -y firebase-tools@latest deploy --only hosting --project PROJECT_ID
   ```

   Thay `PROJECT_ID` bằng ID thật. Nếu chưa đăng nhập CLI, chạy `npx -y firebase-tools@latest login` trước. Không chạy `npx -y firebase-tools@latest init hosting` để tránh ghi đè cấu hình URL hiện có.
7. Mở `https://PROJECT_ID.web.app/admin/`, bấm Login, rồi bấm **Đăng nhập bằng GitHub** trong cửa sổ đăng nhập. Cho phép popup khi trình duyệt yêu cầu. Đăng nhập này yêu cầu scope GitHub `public_repo` để Decap có thể tạo fork/nhánh/pull request cho repo công khai.

CMS phải được mở trên Firebase Hosting cho bản cấu hình này. Bản `/admin/` xuất hiện trên Netlify/Vercel/Railway sẽ chỉ hiển thị hướng dẫn cấu hình khi không có Firebase init endpoint. Nội dung website công khai vẫn được phục vụ bình thường trên các host đó.

## Quyền người soạn và chủ repo

- Tài khoản chủ repo là `reonica`, chịu trách nhiệm duyệt và merge pull request để xuất bản.
- Người chỉ soạn bài **không được cấp quyền write/maintain/admin hoặc quyền merge trên repo chính**. Decap Open Authoring dùng fork của chính họ để lưu bản nháp, sau đó gửi pull request về `reonica/avecjo`.
- Firebase Authentication xác thực tài khoản; quyền ghi/merge do **GitHub** thực thi. Chỉ ẩn nút Publish trong giao diện không phải cơ chế phân quyền.
- Nếu repo đang có người khác có quyền ghi hoặc GitHub App có quyền merge, họ cũng có thể xuất bản. Kiểm tra **GitHub → Settings → Collaborators** và quyền ứng dụng trước khi mời người soạn dùng thử; không cần mời họ thành collaborator có quyền ghi.
- Repo hiện công khai. Bản nháp/pull request trên các fork công khai cũng công khai; đây không phải kho bản thảo riêng tư.

## Soạn, gửi duyệt, xuất bản

1. Người soạn mở `/admin/`, đăng nhập GitHub, chấp nhận tạo fork khi Decap hỏi.
2. Chọn **Bài blog → Bài viết**, điền tiêu đề, slug, SEO, ảnh/alt, category, tags, ngày và nội dung tiếng Pháp.
3. Dùng **Media** để upload ảnh, tối đa 5 MB/ảnh từ trường ảnh đại diện. Chèn ảnh vào nội dung bằng đường dẫn `/assets/images/ten-anh.jpg`; không dán ảnh dạng base64.
4. Bấm Save để lưu nháp; chuyển sang **Ready to review** để gửi duyệt (giao diện người có quyền ghi có thể dùng nhãn **In review**).
5. Bạn mở link **Bài chờ duyệt** hoặc GitHub → Pull requests, đọc diff và kết quả **Check content and SEO**. Yêu cầu chỉnh sửa hoặc merge khi đồng ý.
6. Merge vào `main` sẽ kích hoạt các host đã nối GitHub và bật tự deploy. **Firebase Hosting không tự deploy chỉ vì GitHub đổi**: cần thêm GitHub Actions hoặc tiếp tục deploy bằng CLI như bước trên. Chưa có workflow deploy Firebase tự động được kích hoạt trong repo này.

Chỉnh trực tiếp bằng GitHub Desktop vẫn được. Chủ repo có thể commit/push lên `main` như trước; không thay đổi branch protection hoặc quyền repo trong bản cập nhật CMS này.

## Kiểm tra bản thử

Chạy server local và mở `/admin/?demo=1` trên `localhost` hoặc `127.0.0.1`. Backend thử không ghi GitHub. Tài khoản test có các nút xuất bản của người quản lý, nên bản thử **không chứng minh quyền thực tế của người soạn**; cần thử hai tài khoản GitHub sau khi cấu hình Firebase.

Kiểm tra trước khi coi CMS hoạt động hoàn chỉnh:

- Chủ repo đăng nhập được.
- Người soạn không có quyền ghi repo chính đăng nhập, lưu nháp và gửi PR được.
- Người soạn không merge/ghi được vào `main`.
- Chủ repo merge bài thử; các hosting nhận bài, ảnh và sitemap mới.

Tài liệu: [Firebase GitHub login](https://firebase.google.com/docs/auth/web/github-auth), [Firebase Hosting init](https://firebase.google.com/docs/hosting/reserved-urls), [Decap Open Authoring](https://decapcms.org/docs/open-authoring/).
