# Signal Garden V1 — 用户系统与订阅（部署说明）

## 已实现

- Supabase Auth：邮箱注册 / 登录 / 忘记密码 / Google OAuth / 登出
- 页面：`/login`、`/auth/callback`、`/onboarding`、`/my-garden`。`/pricing` 与 `/subscription` 永久跳转到 `/sponsor`
- 数据表：`profiles`、`user_preferences`、`saved_projects`、`follows`、`subscriptions`
- API：`/api/preferences`、`/api/saved`、`/api/follow`
- 收藏 / 关注有数量上限；达到上限时页面只说明已到上限
- Stripe：`/api/stripe/checkout`、`/api/stripe/webhook` 仍在，没有公开入口
- 顶部导航：未登录显示 Sign In，登录后显示头像菜单

## 需要在 Supabase Dashboard 配置

1. Authentication → Providers → Email：开启
2. Authentication → Providers → Google：开启，并填 Google OAuth Client ID / Secret
3. Authentication → URL Configuration：
   - Site URL: `https://YOUR_VPS_HOST_OR_DOMAIN`
   - Redirect URLs: `https://YOUR_VPS_HOST_OR_DOMAIN/auth/callback`
4. 拿到 Project URL 和 anon key，填入服务器 `.env.local`

## 需要在 Google Cloud Console 配置

1. 新建 OAuth Client（Web application）
2. Authorized JavaScript origins: `https://YOUR_VPS_HOST_OR_DOMAIN`
3. Authorized redirect URIs（Supabase 提供）：
   `https://<project-ref>.supabase.co/auth/v1/callback`

## 服务器环境变量

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRO_PRICE_ID=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

改完执行：

```bash
cd /opt/signal-radar
./node_modules/.bin/next build
pm2 restart signal-garden
```

## Stripe 接入

公开站点不再出售订阅。下面只在重新接通后台时使用。

1. 在 Stripe 创建订阅价格，填 `STRIPE_PRO_PRICE_ID`
2. Webhook 指向 `https://YOUR_VPS_HOST_OR_DOMAIN/api/stripe/webhook`
3. 订阅事件：`checkout.session.completed`、`customer.subscription.updated`、`customer.subscription.deleted`

## 支付宝 / 微信

当前 `checkout` 为 sample，返回未配置提示。
后续接支付宝 / 微信时，把 `POST /api/stripe/checkout` 换成对应支付的下单接口，
`subscriptions` 表结构不用改，只改写入来源。
