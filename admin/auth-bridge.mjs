// The Decap popup handshake is restricted to the exact opening window and same origin.
export function createAuthBridge({origin, opener, subscribe, send}) {
  let verified = false, credential = null, done = false;
  const deliver = () => {
    if (!verified || !credential || done) return;
    done = true;
    send(opener, `authorization:github:success:${JSON.stringify({token: credential, provider: 'github'})}`, origin);
    unsubscribe();
    credential = null;
  };
  const receive = event => {
    if (event.source !== opener || event.origin !== origin || event.data !== 'authorizing:github') return;
    verified = true;
    deliver();
  };
  const unsubscribe = subscribe(receive);
  send(opener, 'authorizing:github', origin);
  return {
    complete(token) { if (done) return; if (typeof token !== 'string' || !token) throw new Error('Missing GitHub access token'); credential = token; deliver(); },
    dispose() { credential = null; done = true; unsubscribe(); },
  };
}
