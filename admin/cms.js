const setup = document.getElementById('cms-setup');
const notice = document.getElementById('cms-notice');
const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const demo = isLocal && new URLSearchParams(location.search).get('demo') === '1';

function showSetup(message) {
  setup.replaceChildren();
  const title = document.createElement('h1'); title.textContent = 'CMS đã sẵn sàng để cấu hình';
  const body = document.createElement('p'); body.textContent = message;
  const hint = document.createElement('p'); hint.textContent = 'Mở trang này trên Firebase Hosting sau khi thêm Web app và bật đăng nhập GitHub trong Firebase Authentication.';
  const link = document.createElement('a'); link.href = 'https://console.firebase.google.com/'; link.textContent = 'Mở Firebase Console'; link.rel = 'noopener'; link.target = '_blank';
  setup.append(title, body, hint, link);
}

try {
  if (!window.CMS || !window.Jodit || !window.DOMPurify) throw new Error('Không tải được tài nguyên CMS. Hãy tải lại trang.');
  const response = await fetch('/admin/config.json', {cache: 'no-store'});
  if (!response.ok) throw new Error('Không đọc được cấu hình CMS.');
  const config = await response.json();
  config.load_config_file = false;
  if (demo) {
    config.backend = {name: 'test-repo'};
    config.publish_mode = 'editorial_workflow';
    notice.textContent = 'BẢN THỬ TRÊN MÁY — dữ liệu lưu trong bộ nhớ trình duyệt, không gửi lên GitHub và không xuất bản website.';
  } else {
    let firebaseConfig;
    try {
      const res = await fetch('/__/firebase/init.json', {cache: 'no-store'});
      if (res.ok && (res.headers.get('content-type') || '').includes('json')) firebaseConfig = await res.json();
    } catch { /* Show setup instructions when hosted outside Firebase. */ }
    if (!firebaseConfig?.projectId || !firebaseConfig?.apiKey || !firebaseConfig?.authDomain) {
      showSetup('Chưa tìm thấy cấu hình Firebase của website này.');
    } else {
      config.backend.base_url = location.origin;
      setup.hidden = true;
      window.CMS.init({config});
    }
  }
  if (demo) { setup.hidden = true; window.CMS.init({config}); }
} catch (error) {
  showSetup(error.message || 'Không thể mở CMS.');
}
