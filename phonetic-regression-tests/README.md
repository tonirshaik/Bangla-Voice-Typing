# English word recognition + phonetic regression tests

এই আপডেটে মিশ্র বাংলা-ইংরেজি লেখায় কিছু পরিচিত English শব্দ (যেমন `meeting`, `project`, `computer`) অপরিবর্তিত রাখার ছোট allowlist যোগ করা হয়েছে।

## অগ্রাধিকার

1. `phonetic-dict.js`-এ থাকা বাংলা শব্দ আগে — তাই `ami` → `আমি`, `ki` → `কি`, `na` → `না` অগ্রাধিকার পাবে।
2. allowlist-এ থাকা English শব্দ মূল spelling/capitalization-সহ থাকবে।
3. অন্য শব্দ আগের phonetic/candidate নিয়মেই যাবে।

তালিকাটি ইচ্ছাকৃতভাবে সীমিত এবং চার বা তার বেশি অক্ষরের শব্দ রাখে, যাতে ছোট ambiguous Roman শব্দগুলো সহজে English হিসেবে ধরে না ফেলে। নতুন English শব্দ দরকার হলে `phonetic-lib.js`-এর `ENGLISH_WORDS` তালিকায় যোগ করো এবং `english-word-cases.json`-এ regression case যোগ করো।

## ফাইল ইনস্টল

- `phonetic-lib.js`-কে Extension-এর মূল ফোল্ডারের পুরোনো ফাইল দিয়ে replace করো। আগে backup রাখবে।
- `phonetic-regression-tests` ফোল্ডারটি Extension-এর মূল ফোল্ডারে রাখো (এই ZIP-এ থাকা ফোল্ডারটির নাম চাইলে `phonetic-regression-tests` করে নাও)।
- মূল ফোল্ডারে `phonetic-dict.js` ও আপডেট করা `phonetic-lib.js` থাকতে হবে।

## টেস্ট চালানো

মূল Extension ফোল্ডারের VS Code Terminal থেকে:

```bash
node phonetic-regression-tests/test-phonetic.js
```

এটি dictionary/converter, raw rules, English/Bangla-priority, এবং mixed text কেস পরীক্ষা করবে। কোনো mismatch হলে FAIL দেখাবে।

## সীমাবদ্ধতা

English allowlist একটি conservative heuristic; এটি সম্পূর্ণ English dictionary নয়। Allowlist-এ যোগ করার আগে নিশ্চিত হও যে শব্দটি Bengali phonetic input-এর সাধারণ Roman spelling নয়। Regression test পাস মানে test case-গুলো ঠিক আছে—সব সম্ভাব্য বাংলা/ইংরেজি শব্দের জন্য নিখুঁত ফল নিশ্চিত নয়।
