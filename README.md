# Guidehanoi · Avec Jo

Bộ website HTML/CSS/JavaScript hoàn chỉnh, có thể upload trực tiếp lên GitHub và deploy qua Netlify. Không cần cài Node.js, npm hoặc chạy build để sử dụng bộ file đã xuất này.

## Upload lên GitHub và Netlify

1. Giải nén `guidehanoi-github-netlify.zip`.
2. Đưa **toàn bộ nội dung bên trong** vào gốc repository GitHub, để `index.html`, `style.css`, `script.js`, `netlify.toml` và `_redirects` nằm ngay ở gốc. Giữ nguyên các thư mục và các file bắt đầu bằng dấu chấm.
3. Trong Netlify, chọn **Add new project → Import an existing project → GitHub**, rồi chọn repository.
4. Cấu hình **Base directory: trống**, **Build command: trống**, **Publish directory: `.`**. `netlify.toml` đã có cấu hình này.
5. Deploy và mở URL Netlify để kiểm tra trước khi đổi DNS.
6. Trong quản lý domain của Netlify, thêm **www.guidehanoi.com** và **guidehanoi.com**. Dùng `www.guidehanoi.com` làm primary domain để khớp canonical của website hiện tại. Thiết lập DNS theo hướng dẫn Netlify và chờ HTTPS hoạt động.

Nếu upload bằng giao diện GitHub, chia các thư mục thành từng đợt nếu gặp giới hạn số file; dùng GitHub Desktop để đẩy toàn bộ một lần thuận tiện hơn. Không upload riêng file ZIP làm website: cần upload các file đã giải nén.

## Nội dung và đường dẫn được giữ

- 28/28 bài blog: nguyên văn nội dung, 537 heading, 9 bảng, ngày bài và tag gốc.
- 83/83 ảnh public được tham chiếu từ nội dung/site hiện tại, tải về `assets/images/`. Ảnh trong bộ file là ảnh gốc từ guidehanoi.com, không dùng ảnh mockup do AI tạo.
- Ba category gốc, 6 album feedback, các gallery và các trang cũ xuất hiện trong sitemap hiện tại.
- 105 đường dẫn public đã phát hiện được bảo toàn, bao gồm 7 URL mà site gốc chuyển về trang chủ.
- URL tag cũ dạng `/blog?keyword=...` và tìm kiếm `/recherche?keyword=...` hoạt động. Có thêm 20 trang tag tĩnh trong `/tag/`.
- `_redirects` giữ URL dạng `/ten-bai` không cần đổi thành `/ten-bai/`, giữ query, và phục vụ các đường dẫn ảnh `/datafiles/...` cũ qua ảnh local tương ứng.
- `/sitemap` là trang Sitemap cho người đọc; `sitemap.xml` là sitemap XML cho công cụ tìm kiếm. Có `robots.txt`, RSS, canonical và metadata chia sẻ.

Các trang legacy nhiều trang vốn chưa có phần nội dung chi tiết trên site gốc. Bộ mới giữ tên, ảnh, liên kết và nội dung thực có, không viết thêm bài giả. Gallery `/photos-incontournables-vietnam` trên site gốc chưa có ảnh; bộ mới cũng giữ trạng thái này. Các video YouTube gốc được giữ dưới dạng nhúng, cần Internet để phát.

Chi tiết đối chiếu URL/ảnh/nội dung nằm trong `migration/`. API kỹ thuật cũ `/news/index-v3-json` của hệ thống hosting cũ không phải trang public và không cần cho website mới: blog dùng dữ liệu đã xuất trong HTML.

## Form Contact

Form đã chuẩn bị cho **Netlify Forms**, với tên `contact`, honeypot và trang cảm ơn `/merci`.

1. Vào Netlify **Forms → Form detection → Enable form detection** nếu chưa bật.
2. Deploy lại để Netlify nhận diện form.
3. Cấu hình thông báo nhận form về `goavecjo@gmail.com` trong dashboard Netlify nếu muốn được báo qua e-mail.
4. Gửi một form thử trên URL Netlify và kiểm tra mục Forms trước khi chuyển domain.

Khi xem thử trên máy hoặc GitHub Pages, form chuẩn bị một e-mail để bạn tự gửi bằng ứng dụng mail. Nó không báo đã gửi nếu chưa thực sự gửi. WhatsApp, email và bản đồ luôn có liên kết trực tiếp.

## File chính

| File/thư mục | Công dụng |
| --- | --- |
| `index.html` | Trang chủ đã duyệt phương án 03 |
| `style.css`, `script.js` | Giao diện responsive và chức năng tương tác |
| `blog/`, `contact/`, `photo/`, `sitemap/` | Các trang chính |
| Thư mục tên bài/album | `index.html` của từng URL gốc |
| `tag/` | Trang tag tĩnh |
| `assets/images/`, `assets/fonts/` | Ảnh và font local, gồm giấy phép font |
| `data/content.json` | Nguồn nội dung đầy đủ để cập nhật và tạo lại HTML |
| `tools/build.mjs` | Tạo lại các trang, sitemap, RSS và redirect từ dữ liệu |
| `tools/validate.mjs` | Kiểm tra link local, ảnh, URL gốc và nguyên văn từng bài |
| `migration/` | Báo cáo đối chiếu và kiểm tra migration |

## Mở thử trên máy

Chạy trong thư mục website:

```sh
python3 -m http.server 8080
```

Mở `http://127.0.0.1:8080`. Server local có thể thêm dấu `/` cuối URL thư mục; trên Netlify, `_redirects` giữ các URL gốc không có dấu `/` cuối. Không chạy server công khai nếu chỉ cần xem thử trên máy.

## Cập nhật bài, ảnh và thông tin

Nếu chỉ sửa một bài trực tiếp, chỉnh file `ten-bai/index.html`. Để cập nhật đồng bộ cả archive, tag, Sitemap và RSS, sửa `data/content.json` rồi chạy (cần Node.js 20+; không cần npm install):

```sh
node tools/build.mjs
node tools/validate.mjs
```

- Sửa điện thoại, e-mail, địa chỉ, logo hoặc hero trong `site`.
- Thêm bài vào `posts`, giữ `slug` của bài đã xuất bản. `html` chứa nội dung HTML, `category` là slug category, `tags` là mảng tên tag.
- Thêm ảnh vào `assets/images/`, rồi dùng đường dẫn `assets/images/ten-anh.jpg` trong dữ liệu. Trong HTML nội dung bài, có thể dùng `/assets/images/ten-anh.jpg`; bộ build chuyển sang đường dẫn relative theo trang.
- Thêm album feedback trong `albums` với `kind: "album"`, `slug`, `title`, `image` và `images: [{src, alt, caption}]`. Để đưa album vào carousel trang chủ, sửa `feedbackOrder` trong `tools/build.mjs`.
- Push các file thay đổi lên GitHub; Netlify deploy lại từ repository.

Không chạy lại `tools/crawl.py` sau khi đổi domain, vì lúc đó guidehanoi.com sẽ trỏ vào bộ website mới. Script crawl dùng để lưu vết migration, không cần khi vận hành.

## GitHub Pages (tùy chọn)

Có thể dùng GitHub Pages để xem bản tĩnh: vào **Settings → Pages → Deploy from a branch → main / root**. Các trang dùng đường dẫn relative nên hoạt động ở `/ten-repo/`; form Contact dùng e-mail ở môi trường này. Nếu cần trang 404 ở GitHub Pages dạng project, đổi `<base href="/">` trong `404.html` thành `<base href="/ten-repo/">`. Các rewrite giữ URL và alias ảnh cũ dành cho Netlify, nên việc chuyển domain thật nên dùng Netlify như kế hoạch.

## Nguồn và giấy phép

Nội dung, logo, ảnh và video được chuyển từ website guidehanoi.com của bạn. Newsreader và Inter được lưu local cùng giấy phép OFL tại `assets/fonts/`. Giao diện được viết mới theo thiết kế đã duyệt; không sao chép nội dung, logo hoặc ảnh của byNativ/Evaneos.
