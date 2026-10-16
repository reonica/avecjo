import {createAuthBridge} from './auth-bridge.mjs';

const button = document.getElementById('github-login');
const status = document.getElementById('auth-status');
const show = (message, failed = false) => { status.textContent = message; status.classList.toggle('error', failed); };

async function initialize() {
  if (!window.opener) { show('Mở trang quản trị /admin/ và bấm đăng nhập tại đó.', true); return; }
  const bridge = createAuthBridge({
    origin: location.origin,
    opener: window.opener,
    subscribe(handler) { window.addEventListener('message', handler); return () => window.removeEventListener('message', handler); },
    send(target, message, origin) { target.postMessage(message, origin); },
  });
  window.addEventListener('pagehide', () => bridge.dispose(), {once: true});
  const response = await fetch('/__/firebase/init.json', {cache: 'no-store'});
  if (!response.ok || !(response.headers.get('content-type') || '').includes('json')) throw new Error('Chưa có cấu hình Firebase Hosting cho CMS.');
  const config = await response.json();
  if (!config.projectId || !config.apiKey || !config.authDomain) throw new Error('Cấu hình Firebase Web app chưa đầy đủ.');
  const [{initializeApp}, authSDK] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js'),
  ]);
  const app = initializeApp(config);
  const auth = authSDK.getAuth(app);
  await authSDK.setPersistence(auth, authSDK.inMemoryPersistence);
  const provider = new authSDK.GithubAuthProvider();
  provider.addScope('public_repo');
  provider.setCustomParameters({allow_signup: 'false'});
  button.disabled = false;
  show('Sẵn sàng. Bấm nút để tiếp tục với GitHub.');
  button.addEventListener('click', async () => {
    button.disabled = true;
    show('Đang đăng nhập GitHub…');
    try {
      const result = await authSDK.signInWithPopup(auth, provider);
      const token = authSDK.GithubAuthProvider.credentialFromResult(result)?.accessToken;
      if (!token) throw new Error('Không nhận được quyền truy cập GitHub.');
      bridge.complete(token);
      await authSDK.signOut(auth);
      show('Đã đăng nhập. Bạn có thể quay lại trang quản trị.');
    } catch (error) {
      const explanations = {
        'auth/operation-not-allowed': 'Cần bật GitHub trong Firebase Authentication → Sign-in method.',
        'auth/unauthorized-domain': 'Cần thêm tên miền CMS vào Authorized domains trong Firebase Authentication.',
        'auth/popup-blocked': 'Trình duyệt đang chặn cửa sổ đăng nhập. Hãy cho phép popup cho trang này rồi thử lại.',
        'auth/popup-closed-by-user': 'Cửa sổ đăng nhập đã đóng. Bạn có thể thử lại.',
        'auth/account-exists-with-different-credential': 'Tài khoản này đã dùng một cách đăng nhập khác trong Firebase. Cần liên kết GitHub với tài khoản đó.',
      };
      show(explanations[error.code] || 'Không thể đăng nhập GitHub. Kiểm tra cấu hình OAuth trong Firebase rồi thử lại.', true);
      button.disabled = false;
    }
  });
}

initialize().catch(() => show('Chưa thể kết nối đăng nhập. Cần cấu hình Web app và GitHub provider trên Firebase Hosting.', true));
