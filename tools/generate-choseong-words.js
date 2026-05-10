#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const WIKTIONARY_API_URL = 'https://en.wiktionary.org/w/api.php';
const USER_AGENT = 'heeheebot-choseong-wordlist/0.1 (local development; Wiktionary API)';
const DEFAULT_OUTPUT_PATH = 'data/choseong-ko.txt';
const DEFAULT_WORDCHAIN_PATH = 'data/wordchain-ko.txt';
const MIN_WORD_LENGTH = 2;
const MAX_WORD_LENGTH = 2;
const REQUEST_DELAY_MS = 800;
const MAX_RETRIES = 4;

const SOURCE_PAGES = Object.freeze([
  'Appendix:Basic Korean Vocabulary List',
  'Appendix:Basic Korean Vocabulary List/500',
  'Appendix:Basic Korean Vocabulary List/1000',
  'Appendix:Basic Korean Vocabulary List/1500',
  'Appendix:Basic Korean Vocabulary List/2000',
  'Appendix:Basic Korean Vocabulary List/3000',
  'Appendix:Basic Korean Vocabulary List/4000',
  'Appendix:Basic Korean Vocabulary List/5000',
  'Appendix:Basic Korean Vocabulary List/6000',
  'Appendix:Basic Korean Vocabulary List/7000',
  'Appendix:Basic Korean Vocabulary List/8000',
  'Appendix:Basic Korean Vocabulary List/9000',
  'Appendix:Basic Korean Vocabulary List/Above 10,000'
]);

async function main() {
  const args = process.argv.slice(2);
  const outputPath = resolve(getOption(args, ['--output', '-o']) ?? DEFAULT_OUTPUT_PATH);
  const wordchainPath = resolve(getOption(args, ['--wordchain']) ?? DEFAULT_WORDCHAIN_PATH);
  const entries = new Map();

  await addLocalWordchainWords(entries, wordchainPath);

  for (const page of SOURCE_PAGES) {
    const wikitext = await fetchWikitext(page);
    let pageEntryCount = 0;

    for (const match of wikitext.matchAll(/\{\{ko-linker\|([^|}\n]+)\|([^|}\n]+)\}\}/g)) {
      pageEntryCount += 1;
      const word = normalizeWord(match[1]);
      const partOfSpeech = match[2].trim();

      if (!word) continue;
      entries.set(word, entries.get(word) ?? { word, partOfSpeech, page });
    }

    console.log(`${page}: ${pageEntryCount.toLocaleString()} entries scanned, ${entries.size.toLocaleString()} usable words`);
    await delay(REQUEST_DELAY_MS);
  }

  const words = [...entries.keys()].sort((a, b) => a.localeCompare(b, 'ko'));
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${words.join('\n')}\n`, 'utf8');
  console.log(`Wrote ${words.length.toLocaleString()} words to ${outputPath}`);
}

function getOption(args, names) {
  const outputIndex = args.findIndex((arg) => names.includes(arg));

  if (outputIndex >= 0) {
    const output = args[outputIndex + 1];
    if (!output) throw new Error(`${args[outputIndex]} requires a value`);
    return output;
  }

  return null;
}

async function addLocalWordchainWords(entries, path) {
  try {
    const source = await readFile(path, 'utf8');
    let added = 0;

    for (const line of source.split(/\r?\n/)) {
      const word = normalizeWord(line);
      if (!word) continue;
      if (!entries.has(word)) added += 1;
      entries.set(word, entries.get(word) ?? { word, partOfSpeech: 'wordchain', page: path });
    }

    console.log(`${path}: ${added.toLocaleString()} local words added`);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn(`${path}: not found; continuing with Wiktionary only`);
      return;
    }

    throw error;
  }
}

async function fetchWikitext(page) {
  const url = new URL(WIKTIONARY_API_URL);
  url.search = new URLSearchParams({
    action: 'parse',
    page,
    prop: 'wikitext',
    format: 'json',
    origin: '*'
  });

  let response = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT
      }
    });

    if (response.ok) break;

    if (response.status !== 429 || attempt === MAX_RETRIES) {
      throw new Error(`Wiktionary API failed for ${page}: ${response.status} ${response.statusText}`);
    }

    const retryAfterSeconds = Number(response.headers.get('retry-after'));
    const delayMs = Number.isFinite(retryAfterSeconds)
      ? retryAfterSeconds * 1000
      : REQUEST_DELAY_MS * 2 ** attempt;
    console.warn(`Rate limited by Wiktionary API; retrying ${page} in ${delayMs}ms`);
    await delay(delayMs);
  }

  const data = await response.json();
  const wikitext = data.parse?.wikitext?.['*'];

  if (typeof wikitext !== 'string') {
    throw new Error(`Wiktionary API response for ${page} did not include wikitext`);
  }

  return wikitext;
}

function normalizeWord(input) {
  const word = String(input ?? '').normalize('NFC').trim();
  const length = [...word].length;

  if (length < MIN_WORD_LENGTH || length > MAX_WORD_LENGTH) return '';
  if (!/^[가-힣]+$/u.test(word)) return '';
  return word;
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
