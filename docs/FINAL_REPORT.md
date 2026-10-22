# Anoneye — চূড়ান্ত রিপোর্ট

তারিখ: **২২ অক্টোবর ২০২৬** · ব্র্যাঞ্চ: `arena/8888effa-anoneye-platform` · ডিপ্লয়: **হয়নি**

---

## ১. যা তৈরি হয়েছে

* **স্ট্যাক:** Next.js 16.4.2 (App Router, Turbopack), React 19.3, TypeScript strict,
  Tailwind CSS 4, lucide-react, zod 4, Supabase JS/SSR।
* **ভাষা:** ইন্টারফেস ডিফল্ট **বাংলা**, উপরের বাটন থেকে English; পছন্দ ব্রাউজারে ও
  সাইন-ইন থাকলে অ্যাকাউন্টে সংরক্ষিত হয়। প্রতিটি স্ট্রিং অভিধানে টাইপ-চেক করা।
* **থিম:** উজ্জ্বল/গাঢ়/সিস্টেম, কোনো ফ্ল্যাশ ছাড়া; ৩২০px থেকে ডেস্কটপ পর্যন্ত রেসপন্সিভ।
* **অথ:** ইমেইল+পাসওয়ার্ড সাইনআপ/লগইন/লগআউট, সুরক্ষিত ড্যাশবোর্ড/ট্র্যাকিং/
  রিপোর্ট/সেটিংস, ডেটা ও অ্যাকাউন্ট এক্সপোর্ট/মুছে ফেলা, সেশন-ভিত্তিক সার্ভার গার্ড।
* **অনুসন্ধান:** কঠোর URL/ইউজারনেম পার্সিং (শুধু অনুমোদিত হোস্ট, পোস্ট/স্টোরি
  লিংক বাতিল), ক্যানোনিকাল URL, ক্যাপাবিলিটি-ভিত্তিক সৎ ব্যাখ্যা।
* **প্রোফাইল:** কার্ড, মেট্রিক, সীমাবদ্ধতা, উৎস ও সময়, ট্র্যাক/রিফ্রেশ।
* **মিডিয়া গ্যালারি:** শুধু API-প্রদত্ত পাবলিক মিডিয়া; ডাউনলোড বা প্রক্সি নেই।
* **ট্র্যাকিং:** সর্বোচ্চ ২৫ প্রোফাইল, প্রথম সিঙ্কে যাচাই, তারপর ম্যানুয়াল রিফ্রেশ,
  পজ/রিজিউম, মুছে ফেলা (টাইপ-করা নিশ্চিতকরণ), ব্যর্থ হলে সারি রাখা হয় না।
* **সিঙ্ক ইঞ্জিন:** সফল লুকআপেই একটিমাত্র স্ন্যাপশট; বাস্তব টাইমস্ট্যাম্প;
  সীমাবদ্ধ এক্সপোনেনশিয়াল ব্যাকঅফ (সর্বোচ্চ ৩ চেষ্টা); ক্রন-রেডি
  `POST /api/cron/sync` (Bearer `CRON_SECRET`)।
* **রিপোর্ট:** তারিখ রেঞ্জ (ডিফল্ট ৩০, সর্বোচ্চ ৩৬৬ দিন), দৈনিক/সাপ্তাহিক সারাংশ,
  কভারেজ, পরিবর্তন, টপ পোস্ট, চার্ট, CSV (RFC 4180, BOM, ফর্মুলা গার্ড, ফাঁকা বনাম `0`)।
* **নিরাপত্তা:** Supabase RLS মাইগ্রেশন, সার্ভার-সাইড ownership check, রেট লিমিট,
  same-origin যাচাই, zod ভ্যালিডেশন, AES-256-GCM টোকেন এনক্রিপশন, scrypt পাসওয়ার্ড,
  সিক্রেট-মুক্ত লগ, নিরাপদ রিডাইরেক্ট।
* **PWA:** ম্যানিফেস্ট, সার্ভিস ওয়ার্কার, আইকন, অফলাইন পেজ।

## ২. কাজ করা পেজ (লোকাল ব্যাকএন্ড + ডেমো মোডে যাচাইকৃত)

| পথ | ফলাফল |
| --- | --- |
| `/` | ২০০, বাংলা হিরো, সৎ ক্যাপাবিলিটি কপি |
| `/search`, `/search?q=…` | ২০০, যাচাই + লুকআপ/ব্যাখ্যা |
| `/profile/instagram/anoneye.demo` | ২০০, ডেমো ব্যাজ ও মেট্রিক |
| `…/media` | ২০০, গ্যালারি, ডাউনলোড নেই |
| `/profile/facebook/anoneye.demo` | ২০০ |
| `/dashboard` | সাইন-ইন ছাড়া ৩০৭; সাইন-ইন করে ২০০ (শুধু নিজের ডেটা) |
| `/dashboard/tracked`, `/dashboard/reports` | ২০০, ট্র্যাকিং ও CSV লিংক |
| `/settings` | ২০০, অ্যাকাউন্ট/ভাষা/থিম/সংযোগ/ডেটা |
| `/login`, `/signup` | ২০০ |
| `/privacy`, `/terms`, `/contact`, `/offline` | ২০০ |
| `/this-page-does-not-exist` | ৪০৪ ব্র্যান্ডেড পেজ |
| `/manifest.webmanifest`, `/robots.txt`, `/sitemap.xml` | ২০০ |

## ৩. ক্রেডেনশিয়াল-নির্ভর (এখানে যাচাই করা সম্ভব হয়নি)

* **Meta লুকআপ ও OAuth** — কোড ডকুমেন্টেড কন্ট্র্যাক্ট অনুযায়ী লেখা, কিন্তু আসল
  অ্যাপ ছাড়া চালানো যায়নি। ক্রেডেনশিয়াল ছাড়া UI স্পষ্টভাবে “কনফিগার করা নেই” বলে।
* **Supabase ডেটাবেস/Auth** — মাইগ্রেশন ও RLS পলিসি লেখা হয়েছে; এখানে Supabase CLI
  বা Postgres নেই, তাই লাইভ প্রজেক্টে চালানো হয়নি।
* **সুপ্রিম/admin অপারেশন** — service role key ছাড়া অচল, যা এখানে নেই।

এগুলো কখনো “পাস” হিসেবে দাবি করা হয়নি।

## ৪. প্রকৃত টেস্ট ও বিল্ড ফলাফল

| চেক | ফলাফল |
| --- | --- |
| `npm run lint` | **০ সমস্যা** |
| `npx tsc --noEmit` | **ক্লিন** (strict) |
| `npm test` | **৭৪/৭৪ পাস**, ১১ ফাইল (ইউনিট + ইন্টিগ্রেশন) |
| `npm run build` | **সফল**, সব রুট emitted |
| `npm run test:e2e` | **ব্লকড** — Chromium ডাউনলোড ও লো-লেভেল ব্রাউজার নেই |

E2E স্পেক (`tests/e2e/*.spec.ts`) লেখা ও টাইপ-চেক করা আছে; ব্রাউজার থাকলে
`npx playwright install chromium && npm run test:e2e` চালান। এগুলো এখানে **চালানো হয়নি**।

## ৫. যাচাইয়ের সময় পাওয়া ও ঠিক করা ত্রুটি

1. **ক্যাশ লিক (গুরুতর):** সাইন-আউট অবস্থায় `/dashboard` ও `/settings` শেয়ার্ড
   ক্যাশ থেকে `307` ফেরত দিচ্ছিল (`x-nextjs-cache: HIT`, `s-maxage=31536000`)।
   এখন `await connection()` (লেআউট + পেজ + হেডার) এবং প্রক্সিতে আসল `307`;
   যাচাই: দুই ব্যবহারকারীর পেজে শুধু নিজের ইমেইল, হেডার `private, no-store`।
2. `new Date()` প্রিরেন্ডারে ত্রুটি — উপরের ফিক্সে সার্ভার লগ পরিষ্কার।
3. ডেমো ইতিহাস বারবার যোগ হচ্ছিল → idempotent করা হয়েছে।
4. `DELETE /api/tracked/{id}` ক্লায়েন্ট বডি ছাড়া ব্যর্থ হচ্ছিল → `{}` পাঠানো হয়।
5. `javascript:` ইনপুট ইউজারনেম হিসেবে যাচ্ছিল → `bad-url`।
6. Turbopack-এর “whole project traced” সতর্কতা → `turbopackIgnore`।
7. `MEDIA_DOWNLOAD_ENABLED` বাতিল; `configStatus().mediaDownload` সর্বদা `false`।

## ৬. জানা সীমাবদ্ধতা

* **মিডিয়া ডাউনলোড, স্টোরি ভিউয়ার, প্রোফাইল ভিজিটর** — Meta অনুমোদন দেয় না;
  অ্যাপ স্পষ্টভাবে অসম্ভব বলে, ভান করে না।
* Instagram Business Discovery শুধু Business/Creator; প্রাইভেট/সাধারণ নয়।
* Facebook-এ PPCA ছাড়া শুধু নিজের ম্যানেজ করা Pages।
* রেট লিমিটার in-process — একাধিক ইনস্ট্যান্সে শেয়ার্ড স্টোর দরকার।
* CSP ও `X-Frame-Options` সেট করা হয়নি (হোস্টেড প্রিভিউ iframe-এ চলে)।
* কন্ট্যাক্ট ফর্ম মেসেজ সংরক্ষণ করে, ইমেইল পাঠায় না।
* `next build`-এ কোনো ব্লকিং সতর্কতা নেই; শুধু SQLite experimental warning (রানটাইম)।

## ৭. লোকাল চালানোর নির্দেশ

```bash
cd anoneye-platform
npm install

cp .env.example .env.local
# .env.local-এ কমপক্ষে:
# ANONEYE_ALLOW_LOCAL_BACKEND=1
# ANONEYE_DEMO_MODE=1

npm run dev            # http://localhost:3000
```

ডেমো: `/search` → `anoneye.demo` → Instagram → প্রোফাইল → ট্র্যাক → রিপোর্ট।

চেক: `npm run lint && npx tsc --noEmit && npm test && npm run build`
ব্রাউজার টেস্ট: `npx playwright install chromium && npm run test:e2e`

## ৮. ডিপ্লয়ের আগে ঠিক যা করতে হবে

1. **Supabase:** প্রজেক্ট খুলুন → Email auth চালু → `supabase/migrations/0001_init.sql`
   ও `0002_demo_support.sql` চালান → RLS যাচাই করুন → Auth URL-এ
   `https://<ডোমেইন>/auth/callback` যোগ করুন।
2. **Meta:** Business টাইপ অ্যাপ → Facebook Login + Instagram API with Facebook Login →
   Valid OAuth Redirect URI `https://<ডোমেইন>/api/oauth/meta/callback` →
   পারমিশন `instagram_basic, instagram_manage_insights, pages_read_engagement,
   pages_show_list, public_profile` → পাবলিক Pages-এর জন্য PPCA (App Review +
   business verification) → অ্যাপ Live করুন।
3. **এনভায়রনমেন্ট:** `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`,
   `TOKEN_ENCRYPTION_KEY` (৩২-বাইট base64: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`),
   `CRON_SECRET` (≥১৬ অক্ষর)।
4. **প্রোডাকশনে বন্ধ:** `ANONEYE_ALLOW_LOCAL_BACKEND`, `ANONEYE_DEMO_MODE`।
5. **ডিপ্লয়ের পর যাচাই:** `/api/health` → `status:"ok"`, `backend:"supabase"`,
   `issueCount:0`; ডেমো সারি শূন্য; দুই অ্যাকাউন্টের ক্রস-অ্যাক্সেস ৪০৪;
   OAuth সংযোগের পর `connected_account_secrets`-এ শুধু সাইফারটেক্সট।
6. **শিডিউলার:** প্রতিদিন একবার
   `curl -X POST https://<ডোমেইন>/api/cron/sync -H "Authorization: Bearer $CRON_SECRET"`।

## ৯. আরও ডকুমেন্টেশন

`README.md` (বাংলা) · `docs/ARCHITECTURE.md` · `docs/API_CAPABILITIES.md` ·
`docs/SECURITY.md` · `docs/TESTING.md` · `docs/DEPLOYMENT.md`
