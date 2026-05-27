/**
 * ますみのこえ 自動テスト（GitHub Actions用・シンプル版）
 */
const { chromium } = require('playwright');
const fs = require('fs');

const APP_URL = 'https://cozyiwasaki.github.io/masumi/';
const TEST_COUNT = parseInt(process.env.TEST_COUNT || '100');

const results = { success: 0, fail: 0, errors: {} };

async function main() {
  console.log(`🌸 テスト開始: ${TEST_COUNT}回`);
  const browser = await chromium.launch({ headless: true });

  for (let i = 0; i < TEST_COUNT; i++) {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
    });
    const page = await context.newPage();

    // JSエラー検知
    page.on('pageerror', err => {
      const key = 'JSError: ' + err.message.substring(0, 80);
      results.errors[key] = (results.errors[key] || 0) + 1;
    });

    try {
      // ページ読み込み
      await page.goto(APP_URL, { timeout: 10000 });
      await page.waitForTimeout(2000); // 音声ファイル読み込み待機

      // ホーム画面確認
      const homeVisible = await page.$eval('#homeScreen',
        el => el.style.display !== 'none').catch(() => false);
      if (!homeVisible) throw new Error('ホーム画面が表示されない');

      // ランダムテスト
      const tests = [
        // カテゴリタップ
        () => page.evaluate(() => {
          document.getElementById('card-kihon')?.click();
          setTimeout(() => document.getElementById('backBtn')?.click(), 500);
        }),
        // TTSタブ
        () => page.evaluate(() => {
          document.getElementById('navTTS')?.click();
          setTimeout(() => document.getElementById('navHome')?.click(), 300);
        }),
        // リアクションタブ
        () => page.evaluate(() => {
          document.getElementById('navRX')?.click();
          setTimeout(() => document.getElementById('navHome')?.click(), 300);
        }),
        // 筆談タブ→戻る
        () => page.evaluate(() => {
          document.getElementById('navHD')?.click();
          setTimeout(() => switchTab('home'), 500);
        }),
        // テキスト入力
        () => page.evaluate(() => {
          document.getElementById('navTTS')?.click();
          const inp = document.getElementById('ttsInput');
          if (inp) { inp.value = 'テスト'; inp.dispatchEvent(new Event('input')); }
          setTimeout(() => document.getElementById('navHome')?.click(), 300);
        }),
        // 検索
        () => page.evaluate(() => {
          openCat('nichijo');
          const s = document.getElementById('phraseSearch');
          if (s) { s.value = 'ありがとう'; s.dispatchEvent(new Event('input')); }
          setTimeout(() => goBack(), 500);
        }),
      ];

      const randomTest = tests[Math.floor(Math.random() * tests.length)];
      await randomTest();
      await page.waitForTimeout(600);

      results.success++;
    } catch (e) {
      results.fail++;
      const key = e.message.substring(0, 100);
      results.errors[key] = (results.errors[key] || 0) + 1;
    } finally {
      await context.close();
    }

    if ((i + 1) % 10 === 0) {
      console.log(`進捗: ${i+1}/${TEST_COUNT} | 成功:${results.success} 失敗:${results.fail}`);
    }
  }

  await browser.close();

  // レポート出力
  const rate = ((results.success / TEST_COUNT) * 100).toFixed(1);
  console.log('\n' + '='.repeat(40));
  console.log(`✅ 成功: ${results.success}回 (${rate}%)`);
  console.log(`❌ 失敗: ${results.fail}回`);
  console.log('\n🔴 検出されたエラー:');
  Object.entries(results.errors)
    .sort((a,b) => b[1]-a[1])
    .forEach(([err, count]) => console.log(`  [${count}回] ${err}`));

  fs.writeFileSync('test_results.json', JSON.stringify({
    summary: { total: TEST_COUNT, success: results.success,
      fail: results.fail, rate: rate + '%' },
    errors: results.errors,
    date: new Date().toISOString()
  }, null, 2));

  if (results.fail > TEST_COUNT * 0.1) {
    console.log('\n⚠️ 失敗率が10%を超えています。バグを修正してください。');
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
