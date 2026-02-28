import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { I18n } from './i18n';
import { SupportedLanguage } from './types';

// Get all supported languages from the production code
const SUPPORTED_LANGUAGES = I18n.getSupportedLanguages();

// Helper to get all keys from an object recursively
function getAllKeys(obj: object, prefix: string = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...getAllKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

// Helper to get value by dot-notation path
function getValueByPath(obj: object, path: string): unknown {
  return path.split('.').reduce((current: unknown, key: string) => {
    if (current && typeof current === 'object') {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

describe('I18n', () => {
  describe('Translation Completeness', () => {
    // Get English keys as the reference
    let englishKeys: string[];

    before(() => {
      I18n.setLanguage('en');
      englishKeys = getAllKeys(I18n.t);
    });

    it('should have all keys from English in every language', () => {
      for (const lang of SUPPORTED_LANGUAGES) {
        I18n.setLanguage(lang);
        const langKeys = getAllKeys(I18n.t);

        for (const key of englishKeys) {
          assert.ok(
            langKeys.includes(key),
            `Missing key "${key}" in language "${lang}"`
          );
        }
      }
    });

    it('should not have extra keys in any language beyond English', () => {
      for (const lang of SUPPORTED_LANGUAGES) {
        if (lang === 'en') continue;

        I18n.setLanguage(lang);
        const langKeys = getAllKeys(I18n.t);

        for (const key of langKeys) {
          assert.ok(
            englishKeys.includes(key),
            `Extra key "${key}" in language "${lang}" not found in English`
          );
        }
      }
    });

    it('should have identical structure across all languages', () => {
      I18n.setLanguage('en');
      const referenceKeys = getAllKeys(I18n.t).sort();

      for (const lang of SUPPORTED_LANGUAGES) {
        I18n.setLanguage(lang);
        const langKeys = getAllKeys(I18n.t).sort();

        assert.deepStrictEqual(
          langKeys,
          referenceKeys,
          `Language "${lang}" has different structure than English`
        );
      }
    });
  });

  describe('Translation Quality', () => {
    it('should have no empty string translations', () => {
      for (const lang of SUPPORTED_LANGUAGES) {
        I18n.setLanguage(lang);
        const keys = getAllKeys(I18n.t);

        for (const key of keys) {
          const value = getValueByPath(I18n.t, key);
          assert.ok(
            typeof value === 'string' && value.trim() !== '',
            `Empty translation for key "${key}" in language "${lang}"`
          );
        }
      }
    });

    it('should have no null or undefined translations', () => {
      for (const lang of SUPPORTED_LANGUAGES) {
        I18n.setLanguage(lang);
        const keys = getAllKeys(I18n.t);

        for (const key of keys) {
          const value = getValueByPath(I18n.t, key);
          assert.ok(
            value !== null && value !== undefined,
            `Null/undefined translation for key "${key}" in language "${lang}"`
          );
        }
      }
    });

    it('should not have obvious English text in non-English translations', () => {
      // Common English patterns that should be translated
      const englishPatterns = [
        /^Loading\.\.\.$/i,
        /^Error$/i,
        /^Settings$/i,
        /^Refresh$/i,
        /^Today$/i,
        /^Yesterday$/i,
        /^This Month$/i,
        /^All Time$/i,
      ];

      // Keys that are allowed to contain English (like "Claude Code", "Token")
      const allowedEnglishKeys = [
        'statusBar.noData',
        'statusBar.notRunning',
        'popup.title',
        'popup.totalTokens',
        'popup.inputTokens',
        'popup.outputTokens',
        'settings.title',
      ];

      for (const lang of SUPPORTED_LANGUAGES) {
        if (lang === 'en') continue;

        I18n.setLanguage(lang);
        const keys = getAllKeys(I18n.t);

        for (const key of keys) {
          if (allowedEnglishKeys.some((allowed) => key.includes(allowed))) {
            continue;
          }

          const value = getValueByPath(I18n.t, key);
          if (typeof value === 'string') {
            for (const pattern of englishPatterns) {
              assert.ok(
                !pattern.test(value),
                `Untranslated English "${value}" for key "${key}" in language "${lang}"`
              );
            }
          }
        }
      }
    });
  });

  describe('Locale Mapping', () => {
    it('should return valid locale string for each language', () => {
      const expectedLocales: Record<SupportedLanguage, string> = {
        en: 'en-US',
        'de-DE': 'de-DE',
        'zh-TW': 'zh-TW',
        'zh-CN': 'zh-CN',
        ja: 'ja-JP',
        ko: 'ko-KR',
      };

      for (const lang of SUPPORTED_LANGUAGES) {
        I18n.setLanguage(lang);
        const locale = I18n.getLocaleString();
        assert.strictEqual(
          locale,
          expectedLocales[lang],
          `Incorrect locale for language "${lang}": expected "${expectedLocales[lang]}", got "${locale}"`
        );
      }
    });

    it('should return a valid BCP 47 locale format', () => {
      // BCP 47 format: language-REGION or language
      const bcp47Pattern = /^[a-z]{2}(-[A-Z]{2})?$/;

      for (const lang of SUPPORTED_LANGUAGES) {
        I18n.setLanguage(lang);
        const locale = I18n.getLocaleString();
        assert.ok(
          bcp47Pattern.test(locale),
          `Locale "${locale}" for language "${lang}" is not valid BCP 47 format`
        );
      }
    });
  });

  describe('Formatting Functions', () => {
    describe('formatNumber', () => {
      it('should format numbers correctly for each locale', () => {
        const testNumber = 1234567.89;

        for (const lang of SUPPORTED_LANGUAGES) {
          I18n.setLanguage(lang);
          const formatted = I18n.formatNumber(testNumber);

          // Should not throw an error
          assert.ok(typeof formatted === 'string', `formatNumber returned non-string for ${lang}`);

          // Should contain digits
          assert.ok(/\d/.test(formatted), `formatNumber result "${formatted}" contains no digits for ${lang}`);
        }
      });

      it('should handle zero correctly', () => {
        for (const lang of SUPPORTED_LANGUAGES) {
          I18n.setLanguage(lang);
          const formatted = I18n.formatNumber(0);
          assert.ok(formatted.includes('0'), `formatNumber(0) should contain "0" for ${lang}`);
        }
      });

      it('should handle negative numbers', () => {
        for (const lang of SUPPORTED_LANGUAGES) {
          I18n.setLanguage(lang);
          const formatted = I18n.formatNumber(-1234);
          assert.ok(/[-\u2212]/.test(formatted), `formatNumber(-1234) should contain minus sign for ${lang}`);
        }
      });

      it('should use locale-specific separators', () => {
        // German uses period as thousands separator, comma as decimal
        I18n.setLanguage('de-DE');
        const germanFormatted = I18n.formatNumber(1234567);
        // Should contain a period as thousands separator (1.234.567)
        assert.ok(germanFormatted.includes('.'), `German should use period as thousands separator: ${germanFormatted}`);

        // English uses comma as thousands separator
        I18n.setLanguage('en');
        const englishFormatted = I18n.formatNumber(1234567);
        assert.ok(englishFormatted.includes(','), `English should use comma as thousands separator: ${englishFormatted}`);
      });
    });

    describe('formatCurrency', () => {
      it('should format currency with dollar sign', () => {
        for (const lang of SUPPORTED_LANGUAGES) {
          I18n.setLanguage(lang);
          const formatted = I18n.formatCurrency(123.45);
          assert.ok(formatted.includes('$'), `formatCurrency should include $ for ${lang}`);
        }
      });

      it('should respect decimal places parameter', () => {
        I18n.setLanguage('en');

        assert.strictEqual(I18n.formatCurrency(123.456, 0), '$123');
        assert.strictEqual(I18n.formatCurrency(123.456, 1), '$123.5');
        assert.strictEqual(I18n.formatCurrency(123.456, 2), '$123.46');
        assert.strictEqual(I18n.formatCurrency(123.456, 3), '$123.456');
        assert.strictEqual(I18n.formatCurrency(123.456, 4), '$123.4560');
      });

      it('should default to 2 decimal places', () => {
        I18n.setLanguage('en');
        const formatted = I18n.formatCurrency(123.456);
        assert.strictEqual(formatted, '$123.46');
      });

      it('should handle zero cost', () => {
        I18n.setLanguage('en');
        const formatted = I18n.formatCurrency(0);
        assert.strictEqual(formatted, '$0.00');
      });

      it('should handle very small amounts', () => {
        I18n.setLanguage('en');
        const formatted = I18n.formatCurrency(0.001, 4);
        assert.strictEqual(formatted, '$0.0010');
      });
    });
  });

  describe('Language Detection', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      // Restore original environment
      process.env = { ...originalEnv };
    });

    it('should detect English by default', () => {
      delete process.env.LANG;
      delete process.env.LANGUAGE;
      I18n.setLanguage('auto');
      assert.strictEqual(I18n.getCurrentLanguage(), 'en');
    });

    it('should detect Traditional Chinese for zh_TW locale', () => {
      process.env.LANG = 'zh_TW.UTF-8';
      I18n.setLanguage('auto');
      assert.strictEqual(I18n.getCurrentLanguage(), 'zh-TW');
    });

    it('should detect Traditional Chinese for zh_HK locale', () => {
      process.env.LANG = 'zh_HK.UTF-8';
      I18n.setLanguage('auto');
      assert.strictEqual(I18n.getCurrentLanguage(), 'zh-TW');
    });

    it('should detect Traditional Chinese for zh_MO locale', () => {
      process.env.LANG = 'zh_MO.UTF-8';
      I18n.setLanguage('auto');
      assert.strictEqual(I18n.getCurrentLanguage(), 'zh-TW');
    });

    it('should detect Simplified Chinese for zh_CN locale', () => {
      process.env.LANG = 'zh_CN.UTF-8';
      I18n.setLanguage('auto');
      assert.strictEqual(I18n.getCurrentLanguage(), 'zh-CN');
    });

    it('should detect Simplified Chinese for generic zh locale', () => {
      process.env.LANG = 'zh.UTF-8';
      I18n.setLanguage('auto');
      assert.strictEqual(I18n.getCurrentLanguage(), 'zh-CN');
    });

    it('should detect Japanese for ja locale', () => {
      process.env.LANG = 'ja_JP.UTF-8';
      I18n.setLanguage('auto');
      assert.strictEqual(I18n.getCurrentLanguage(), 'ja');
    });

    it('should detect Korean for ko locale', () => {
      process.env.LANG = 'ko_KR.UTF-8';
      I18n.setLanguage('auto');
      assert.strictEqual(I18n.getCurrentLanguage(), 'ko');
    });

    it('should fall back to English for unknown locales', () => {
      process.env.LANG = 'fr_FR.UTF-8';
      I18n.setLanguage('auto');
      assert.strictEqual(I18n.getCurrentLanguage(), 'en');
    });

    it('should allow manual language setting', () => {
      for (const lang of SUPPORTED_LANGUAGES) {
        I18n.setLanguage(lang);
        assert.strictEqual(I18n.getCurrentLanguage(), lang);
      }
    });
  });

  describe('Source Code Validation', () => {
    const srcDir = path.join(__dirname);
    const sourceFiles = ['webview.ts', 'extension.ts', 'dataLoader.ts', 'statusBar.ts'];

    it('should not have toLocaleString() without locale parameter in source files', () => {
      // Pattern for toLocaleString() without parameters
      const unsafePattern = /\.toLocaleString\(\s*\)/g;

      for (const file of sourceFiles) {
        const filePath = path.join(srcDir, file);
        if (!fs.existsSync(filePath)) continue;

        const content = fs.readFileSync(filePath, 'utf8');
        const matches = content.match(unsafePattern);

        assert.ok(
          !matches,
          `Found toLocaleString() without locale in ${file}: ${matches?.join(', ')}`
        );
      }
    });

    it('should not have toLocaleDateString() without locale parameter in source files', () => {
      // Pattern for toLocaleDateString() without parameters
      const unsafePattern = /\.toLocaleDateString\(\s*\)/g;

      for (const file of sourceFiles) {
        const filePath = path.join(srcDir, file);
        if (!fs.existsSync(filePath)) continue;

        const content = fs.readFileSync(filePath, 'utf8');
        const matches = content.match(unsafePattern);

        assert.ok(
          !matches,
          `Found toLocaleDateString() without locale in ${file}: ${matches?.join(', ')}`
        );
      }
    });

    it('should not have toLocaleTimeString() without locale parameter in source files', () => {
      // Pattern for toLocaleTimeString() without parameters
      const unsafePattern = /\.toLocaleTimeString\(\s*\)/g;

      for (const file of sourceFiles) {
        const filePath = path.join(srcDir, file);
        if (!fs.existsSync(filePath)) continue;

        const content = fs.readFileSync(filePath, 'utf8');
        const matches = content.match(unsafePattern);

        assert.ok(
          !matches,
          `Found toLocaleTimeString() without locale in ${file}: ${matches?.join(', ')}`
        );
      }
    });

    it('should use I18n.formatNumber or locale parameter for number formatting', () => {
      // This test checks that any toLocaleString call on numbers either:
      // 1. Uses I18n.getLocaleString() or a locale parameter
      // 2. Or uses I18n.formatNumber()

      // We look for patterns that suggest locale-unaware formatting
      const suspiciousPatterns = [
        /\d+\.toLocaleString\(\s*\)/g, // Direct number.toLocaleString()
        /\)\s*\.toLocaleString\(\s*\)/g, // result.toLocaleString()
      ];

      for (const file of sourceFiles) {
        const filePath = path.join(srcDir, file);
        if (!fs.existsSync(filePath)) continue;

        const content = fs.readFileSync(filePath, 'utf8');

        for (const pattern of suspiciousPatterns) {
          const matches = content.match(pattern);
          assert.ok(
            !matches,
            `Suspicious locale-unaware number formatting in ${file}: ${matches?.join(', ')}`
          );
        }
      }
    });
  });

  describe('Integration Tests', () => {
    it('should maintain consistent behavior when switching languages', () => {
      // Test that we can switch languages and get correct translations for "today"
      const expectedValues: Record<SupportedLanguage, string> = {
        en: 'Today',
        'de-DE': 'Heute',
        'zh-TW': '今日',
        'zh-CN': '今日',
        ja: '今日',
        ko: '오늘',
      };

      for (const lang of SUPPORTED_LANGUAGES) {
        I18n.setLanguage(lang);
        assert.strictEqual(
          I18n.t.popup.today,
          expectedValues[lang],
          `Incorrect translation for "today" in ${lang}`
        );
      }
    });

    it('should return translations object with correct type', () => {
      for (const lang of SUPPORTED_LANGUAGES) {
        I18n.setLanguage(lang);
        const translations = I18n.t;

        // Check structure
        assert.ok(typeof translations === 'object');
        assert.ok('statusBar' in translations);
        assert.ok('popup' in translations);
        assert.ok('settings' in translations);

        // Check nested structure
        assert.ok(typeof translations.statusBar === 'object');
        assert.ok(typeof translations.popup === 'object');
        assert.ok(typeof translations.settings === 'object');
      }
    });

    it('should format numbers and dates consistently with current locale', () => {
      // Ensure formatNumber uses the correct locale after language change
      I18n.setLanguage('de-DE');
      const germanNumber = I18n.formatNumber(1234.56);

      I18n.setLanguage('en');
      const englishNumber = I18n.formatNumber(1234.56);

      // German and English should format differently
      assert.notStrictEqual(
        germanNumber,
        englishNumber,
        'German and English number formatting should differ'
      );
    });
  });
});
