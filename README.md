# Anoneye

পাবলিক Instagram ও Facebook প্রোফাইল খোঁজা, সময়ভিত্তিক পর্যবেক্ষণ সংরক্ষণ এবং রিপোর্ট তৈরি করার একটি ওয়েব অ্যাপ। ইন্টারফেস শুরুতে **বাংলা**, ডান-উপরের বাটন থেকে **English**-এ বদলানো যায়।

Anoneye শুধু Meta-র **অফিসিয়াল API** ব্যবহার করে। কোনো স্ক্র্যাপিং, ধার করা কুকি/সেশন, প্রাইভেট অ্যাকাউন্টে প্রবেশ, স্টোরি-ভিউয়ার তালিকা বা “প্রোফাইল ভিজিটর” নেই — এগুলো কোনো বৈধ API-তেই নেই, তাই অ্যাপ কোথাও এ ধরনের দাবি করে না।

> **অবস্থা:** অ্যাপটি সম্পূর্ণভাবে তৈরি, টেস্ট ও বিল্ড করা হয়েছে। এই রিপোজিটরি কোথাও ডিপ্লয় করা হয়নি। Meta/Supabase-এর আসল ক্রেডেনশিয়াল ছাড়া লাইভ লুকআপ, OAuth ও Supabase ডেটাবেস এখানে যাচাই করা সম্ভব হয়নি — নিচে ঠিক কোথায় কী সীমাবদ্ধ তা লেখা আছে।

---

## ১. কী কাজ করে

| কাজ | অবস্থা |
| --- | --- |
| প্রোফাইল লিংক/ইউজারনেম যাচাই ও পরিষ্কার করা (কোনো নেটওয়ার্ক কল ছাড়াই) | ✅ কাজ করে |
| বাংলা/English ইন্টারফেস, ডার্ক/লাইট থিম, মোবাইল থেকে ৩২০px পর্যন্ত | ✅ কাজ করে |
| ইমেইল+পাসওয়ার্ড দিয়ে অ্যাকাউন্ট, সুরক্ষিত ড্যাশবোর্ড | ✅ লোকাল ব্যাকএন্ডে যাচাই করা |
| ডেমো প্রোফাইল (`anoneye.demo`) দেখা, ট্র্যাক করা, চার্ট ও CSV রিপোর্ট | ✅ কাজ করে (সব ডেটা “ডেমো ফিক্সচার” লেবেলযুক্ত) |
| আসল Instagram/Facebook প্রোফাইল লুকআপ | ⚙️ কোড আছে; Meta অ্যাপ + পারমিশন + OAuth ছাড়া চালু হয় না |
| সময়ভিত্তিক ইতিহাস, দৈনিক/সাপ্তাহিক সারাংশ, কভারেজ, CSV এক্সপোর্ট | ✅ কাজ করে |
| Supabase (Postgres + Auth + RLS) দিয়ে মাল্টি-ইউজার ডিপ্লয় | ⚙️ কোড ও মাইগ্রেশন আছে; এখানে লাইভ Supabase-এ চালানো হয়নি |
| মিডিয়া ডাউনলোড, স্টোরি দেখা, ভিজিটর আইডি | ❌ নেই — Meta অনুমোদন দেয় না, তাই অ্যাপ পরিষ্কারভাবে বলে দেয় |

সম্পূর্ণ সত্য-তালিকা: [`docs/API_CAPABILITIES.md`](docs/API_CAPABILITIES.md)।

---

## ২. যা লাগবে

* **Node.js 22 বা তার পরের সংস্করণ** (`node -v` দিয়ে দেখুন)
* npm (Node-এর সঙ্গে আসে)
* আসল লুকআপ চালাতে চাইলে: একটি Meta ডেভেলপার অ্যাপ ও তার ক্রেডেনশিয়াল
* মাল্টি-ইউজার ডিপ্লয় চাইলে: একটি Supabase প্রজেক্ট

শুধু অ্যাপ দেখতে কোনো ক্রেডেনশিয়াল লাগে না — ডেমো মোডে চলে।

---

## ৩. প্রথমবার চালানো (ধাপে ধাপে)

### ধাপ ১ — ডিপেন্ডেন্সি ইনস্টল

```bash
cd anoneye-platform
npm install
```

### ধাপ ২ — এনভায়রনমেন্ট ফাইল

```bash
cp .env.example .env.local
```

`NEXT_PUBLIC_SITE_URL` বাদে বাকি সব খালি রাখলেও চলবে। লোকাল ব্যাকএন্ড ও ডেমো চালু করতে `.env.local`-এ এই দুই লাইন রাখুন:

```env
ANONEYE_ALLOW_LOCAL_BACKEND=1
ANONEYE_DEMO_MODE=1
```

> `.env.local` কখনো Git-এ কমিট করবেন না। কোনো পাসওয়ার্ড, টোকেন বা সিক্রেট ব্রাউজারে পাঠানো হয় না।

### ধাপ ৩ — ডেভ সার্ভার

```bash
npm run dev
```

ব্রাউজারে <http://localhost:3000> খুলুন। হোম পেজ বাংলায় আসবে।

### ধাপ ৪ — ডেমো প্রোফাইল দেখা

1. উপরের মেনু থেকে **অনুসন্ধান** খুলুন (অথবা সোজা `/search`)।
2. `anoneye.demo` লিখে প্ল্যাটফর্ম **Instagram** রেখে খুঁজুন।
3. প্রোফাইল পেজে “ডেমো ফিক্সচার” ব্যাজ দেখবেন। **মিডিয়া দেখুন**-এ ছবি/ভিডিওর নমুনা আছে।
4. **ট্র্যাক করা প্রোফাইলে সেভ করুন** চাপলে একটি বাস্তব সিঙ্ক হয় এবং একটি স্ন্যাপশট জমা হয়।
5. ড্যাশবোর্ড → **রিপোর্ট**-এ চার্ট, কভারেজ ও CSV ডাউনলোড পাবেন।
6. ডেমো ইতিহাস (১৪ দিনের নমুনা) যোগ করতে ড্যাশবোর্ড বা ট্র্যাকড পেজে “নমুনা ইতিহাস যোগ করুন” ব্যবহার করুন — এগুলোও স্পষ্টভাবে ডেমো লেবেলযুক্ত।

ডেমো ডেটা কখনো আসল প্রোফাইলের জন্য দেখানো হয় না: শুধু `anoneye.demo` হ্যান্ডেলটিই ডেমো প্রোভাইডারে যায়।

---

## ৪. কমান্ড

| কমান্ড | কাজ |
| --- | --- |
| `npm run dev` | ডেভ সার্ভার (`http://localhost:3000`) |
| `npm run build` | প্রোডাকশন বিল্ড |
| `npm run start` | বিল্ড করা অ্যাপ চালানো |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | TypeScript টাইপ চেক |
| `npm test` | ইউনিট + ইন্টিগ্রেশন টেস্ট (vitest) |
| `npm run test:unit` / `test:integration` | আলাদা করে টেস্ট |
| `npx playwright install chromium` + `npm run test:e2e` | ব্রাউজার টেস্ট (আগে ব্রাউজার ইনস্টল করতে হবে) |
| `npm run check` | lint → typecheck → test → build |

**এই পরিবেশে প্রকৃত ফলাফল (২০২৬-১০-২২):** lint ০ সমস্যা, TypeScript ক্লিন, **৭৪/৭৪ টেস্ট পাস**, প্রোডাকশন বিল্ড সফল। ব্রাউজার E2E এখানে চালানো যায়নি (Chromium ডাউনলোড ব্লকড) — বিস্তারিত [`docs/TESTING.md`](docs/TESTING.md)-এ।

---

## ৫. পেজগুলো

| পথ | কী আছে |
| --- | --- |
| `/` | বাংলা ল্যান্ডিং পেজ, সক্ষমতা ও সীমাবদ্ধতার সৎ বিবরণ |
| `/search` | লিংক/ইউজারনেম যাচাই, লুকআপ ফলাফল |
| `/profile/[platform]/[identifier]` | প্রোফাইল কার্ড, মেট্রিক, ট্র্যাক/রিফ্রেশ |
| `/profile/[platform]/[identifier]/media` | পাবলিক মিডিয়া গ্যালারি (ডাউনলোড নেই) |
| `/dashboard` | KPI, সাম্প্রতিক সিঙ্ক, ত্রুটি |
| `/dashboard/tracked` | ট্র্যাক করা প্রোফাইল, পজ/রিজিউম, মুছে ফেলা |
| `/dashboard/reports` | তারিখ রেঞ্জ, দৈনিক/সাপ্তাহিক চার্ট, CSV |
| `/settings` | নাম, ভাষা, থিম, Meta সংযোগ, ডেটা এক্সপোর্ট/অ্যাকাউন্ট মুছে ফেলা |
| `/privacy`, `/terms`, `/contact` | বাংলা ও ইংরেজি নীতিমালা/যোগাযোগ |
| `/login`, `/signup` | অ্যাকাউন্ট |
| `/offline`, `not-found`, `error` | PWA ও ত্রুটি পেজ |

PWA ম্যানিফেস্ট, সার্ভিস ওয়ার্কার ও আইকন `/manifest.webmanifest`, `public/sw.js`, `public/icons/`-এ আছে।

---

## ৬. আসল Meta API চালু করা

সংক্ষেপে (বিস্তারিত: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)):

1. Meta ডেভেলপার কনসোলে **Business** টাইপের অ্যাপ বানান।
2. Facebook Login + Instagram API with Facebook Login যোগ করুন।
3. Valid OAuth Redirect URI: `https://আপনার-ডোমেইন/api/oauth/meta/callback`।
4. পারমিশন: `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`, `pages_show_list`, `public_profile`।
5. পাবলিক Facebook Pages-এর জন্য **Page Public Content Access** (App Review + business verification) লাগবে।
6. `.env.local`-এ বসান: `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`, `TOKEN_ENCRYPTION_KEY`।
   কী বানাবেন:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
7. অ্যাপ চালু করে `/settings` থেকে **Instagram/Facebook সংযুক্ত করুন** চাপুন।

**সীমাবদ্ধতা:** Instagram Business Discovery শুধু Business/Creator টার্গেট পড়তে পারে; প্রাইভেট/সাধারণ অ্যাকাউন্ট নয়। Facebook-এ PPCA ছাড়া শুধু আপনার ম্যানেজ করা Pages পড়া যায়। কোনো অনুমোদিত উপায়ে মিডিয়া ডাউনলোড, স্টোরি বা ভিজিটর ডেটা পাওয়া যায় না।

`GET /api/health` বলে দেয় কোন ইন্টিগ্রেশন নেই — কোনো গোপন মান প্রকাশ না করেই।

---

## ৭. Supabase (প্রোডাকশন)

1. Supabase প্রজেক্ট খুলুন, Email auth চালু করুন।
2. `supabase/migrations/0001_init.sql` ও `0002_demo_support.sql` পরপর চালান (SQL Editor বা `supabase db push`)।
3. `.env.local`-এ `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` দিন।
4. Auth → URL Configuration-এ Site URL ও `/auth/callback` redirect যোগ করুন।
5. `ANONEYE_ALLOW_LOCAL_BACKEND` ও `ANONEYE_DEMO_MODE` বাদ দিন।

সব টেবিলে RLS চালু; `connected_account_secrets`-এ কোনো ক্লায়েন্ট পলিসি নেই (শুধু সার্ভিস রোল)। বিস্তারিত [`docs/SECURITY.md`](docs/SECURITY.md)-এ।

---

## ৮. প্রকল্পের গঠন

```
app/                 পেজ ও API রুট (App Router)
  api/               auth, lookup, tracked, reports, oauth, cron, health…
components/          UI (landing, profile, dashboard, reports, settings…)
lib/
  api/               ভ্যালিডেশন, এরর ম্যাপিং, রেট লিমিট
  auth/              সেশন, লোকাল auth, Supabase service
  crypto/            AES-256-GCM টোকেন, scrypt পাসওয়ার্ড
  db/                Repository ইন্টারফেস + SQLite + Supabase
  providers/         Instagram, Facebook, demo, graph client
  services/          lookup, sync, reports, meta OAuth
  i18n/              বাংলা/ইংরেজি অভিধান
supabase/migrations/ SQL স্কিমা ও RLS
tests/               unit · integration · e2e (Playwright)
docs/                আর্কিটেকচার, API সীমা, নিরাপত্তা, টেস্টিং, ডিপ্লয়
proxy.ts             Supabase সেশন রিফ্রেশ + রুট সুরক্ষা
```

---

## ৯. নীতি

* কোনো স্ক্র্যাপিং নয়, কোনো ধার করা সেশন নয়, কোনো সোশ্যাল পাসওয়ার্ড চাওয়া হয় না।
* যাচাই করা যায়নি এমন কোনো ফিচার “কাজ করে” বলে দাবি করা হয় না।
* অনুপস্থিত ডেটা ও সত্যিকারের শূন্য আলাদা রাখা হয় (`—` বনাম `0`)।
* ডেমো/নমুনা ডেটা সবসময় লেবেলযুক্ত; কখনো লাইভ ডেটা হিসেবে দেখানো হয় না।
* কেউ কারও ডেটা পড়তে/মুছতে পারে না — সার্ভার-সাইড ownership check + RLS।

## ১০. আরও পড়ুন

* [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — সিস্টেম ডিজাইন ও ডেটা মডেল
* [`docs/API_CAPABILITIES.md`](docs/API_CAPABILITIES.md) — Meta API-র বাস্তব সীমা (যাচাইকৃত সূত্রসহ)
* [`docs/SECURITY.md`](docs/SECURITY.md) — নিরাপত্তা মডেল ও ঝুঁকি
* [`docs/TESTING.md`](docs/TESTING.md) — টেস্ট, প্রকৃত ফলাফল, সীমাবদ্ধতা
* [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — ধাপে ধাপে ডিপ্লয়
