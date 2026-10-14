# Kiểm tra chuyển nội dung Guidehanoi

Nguồn được đọc công khai, không sửa website cũ, không gửi form và không chỉnh tài liệu đồng bộ trong `sources/`.

- Sitemap gốc: 97 URL. Có thêm `/photo` từ footer và 7 đường dẫn cũ trong bài viết chuyển về trang chủ.
- Blog: 28 bài, xác nhận qua cả sitemap/trang bài và API phân trang 3 trang, tổng chính thức 28.
- Nội dung: giữ đầy đủ phần thân bài; loại script, trình xử lý sự kiện và kiểu trình bày cũ. Không viết lại nội dung.
- 83 ảnh nguồn đã tải local và kiểm tra định dạng ảnh thành công. `asset-manifest.json` ghi đường dẫn gốc và tệp mới.
- `content-verification.json` đối chiếu văn bản và số heading, bảng, ảnh giữa từng bài nguồn và bài đã chuyển. 28/28 bài có văn bản giống nguyên bản sau khi bỏ markup.
- Các tag vẫn dùng `blog?keyword=...`; URL phân trang cũ cần xử lý tương thích qua trang blog mới. Manifest lưu cả dạng mã hóa và dạng ký tự nguyên gốc.
- Sáu trang feedback gốc mỗi trang có một ảnh bìa, không có ảnh con trong dữ liệu album. Hai gallery Photo và Photos clients avec Jo có sáu ảnh thật.
- Gallery `/photos-incontournables-vietnam` ở nguồn chưa có ảnh công khai. Không tự tạo ảnh thay thế.
- `/recherche` ở nguồn cần tham số tìm kiếm; khi gọi không có tham số, nguồn trả 302. Website mới giữ đường dẫn tìm kiếm này.
- Nhiều trang tour, destination và service cũ chưa có thân bài. Các trang đó giữ tên, ảnh và liên kết danh sách thực tế, không tạo bài giả. Sáu video nguồn giữ liên kết nhúng YouTube; ba trang sản phẩm giữ các ảnh trong gallery nguồn.

`url-manifest.json` là danh sách URL nguồn và cách giữ đường dẫn. `coverage.json` chứa tổng số, chuyển hướng thực tế, các đường dẫn ảnh cũ (`assetAliases`) và hạn chế của dữ liệu nguồn. Các bản HTML/JSON nguồn được cache riêng ngoài thư mục deploy, trong `work/guidehanoi-migration/`.

Crawler `tools/crawl.py` chỉ đọc cache và chuẩn bị cấu hình curl cho những tệp còn thiếu. Chạy curl với cấu hình `work/guidehanoi-migration/curl-jobs.conf`, lưu JSON kết quả vào `curl-results.jsonl`, rồi chạy crawler lại để nhập kết quả và xuất dữ liệu. Network chạy qua curl riêng; crawler không tự gửi request mạng.
