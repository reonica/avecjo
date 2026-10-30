# Firebase Hosting

Project chính `avec-jo`, public directory `dist/`. Web: https://avec-jo.web.app ; đăng nhập CMS: https://avec-jo.web.app/backend . `/admin` chuyển hướng về `/backend`.

```sh
npm run build
npm run check
npx firebase-tools deploy --only hosting:main --project avec-jo
```

Build giữ URL cũ, rewrite ảnh và noindex cho CMS. Không upload PHP hoặc dữ liệu CMS riêng. Chưa đăng nhập, các đường dẫn trong backend đều chỉ hiển thị form. `?demo=1` chỉ được hỗ trợ trên localhost.

API PHP và kho file nội dung/tài khoản nằm trên PA khi hosting sẵn sàng. CMS này không cần database; MySQL chỉ bật riêng cho liên hệ khách. Xem [docs/DEPLOY-PA.md](docs/DEPLOY-PA.md). Runtime config chỉ chứa URL API và cờ bật form; không chứa thông tin bí mật.

Site cũ `avecjo-cms` đã ngừng phục vụ và 3 phiên bản Hosting cũ đã được xóa. Không cần xóa project Google Cloud để vận hành CMS mới.
