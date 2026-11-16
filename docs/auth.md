# Authentication

Two tokens:

| | Access token | Refresh token |
|---|---|---|
| Format | JWT `{ sub: userId }`, signed with `JWT_SECRET` | Opaque random string |
| Lifetime | `JWT_ACCESS_EXPIRES_IN` (default 900 s = 15 min) | `JWT_REFRESH_EXPIRES_IN` (default 2592000 s = 30 days) |
| Sent as | `Authorization: Bearer <accessToken>`, socket handshake `auth.token` | JSON body of `/auth/refresh` and `/auth/logout` only |
| Server side | Verified by signature, nothing stored | Only its sha256 is stored in `refresh_tokens`, so it can be revoked |

## Endpoints

| Request | Body | Response |
|---|---|---|
| `POST /auth/register` | `RegisterDto` | `201 { accessToken, refreshToken, user }` |
| `POST /auth/login` | `{ email, password }` | `200 { accessToken, refreshToken, user }` |
| `POST /auth/refresh` | `{ refreshToken }` | `200 { accessToken, refreshToken }` or `401` |
| `POST /auth/logout` | `{ refreshToken }` | `204`, also for unknown tokens |
| `POST /auth/logout-all` | Bearer access token | `204`: revokes every refresh token of the user |

## Rotation and reuse detection

Each `/auth/refresh` revokes the presented token and returns a **new pair**. The client must replace both tokens it stored.

A refresh token works only once. If an already revoked token is presented again, the server assumes it was stolen and revokes **all** refresh tokens of that user. Both the attacker and the real user then have to log in again. Two concurrent refreshes with the same token are treated the same way, so the client must not refresh in parallel (see below).

Access tokens are not revoked: after logout, or after reuse is detected, an already issued access token stays valid until it expires (≤ 15 min by default).

## Client flow

```ts
let refreshing: Promise<void> | null = null;

async function api(path: string, init: RequestInit = {}) {
  let res = await send(path, init);
  if (res.status === 401) {
    // One refresh at a time: concurrent 401s wait for the same promise.
    refreshing ??= refreshTokens().finally(() => (refreshing = null));
    await refreshing;
    res = await send(path, init);
  }
  return res;
}

async function refreshTokens() {
  const res = await fetch('/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: storage.refreshToken }),
  });
  if (!res.ok) {
    storage.clear();
    redirectToLogin();
    throw new Error('Session expired');
  }
  const { accessToken, refreshToken } = await res.json();
  storage.save({ accessToken, refreshToken });
}
```

Sockets check the access token only at connect time. After a refresh, the next reconnect picks up the new token if `auth` is a function (see [realtime.md](realtime.md#connecting)).
