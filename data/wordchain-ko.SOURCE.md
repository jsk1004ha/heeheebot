# wordchain-ko.txt source

Generated from AutoKkutu's Korean KKuTu database dump:

- Repository: https://github.com/hsheric0210/AutoKkutu
- Branch: `v1.3`
- Source file: `KkutuDbDump/kor_list.txt`
- Source count: 357,644 lines / 357,644 unique words.
- Source extractor in repository: `KkutuDbDump/Whole database extractor.bat`
  - It exports `_id` from `public.kkutu_ko` where `LENGTH(_id) > 1` and `type` matches the Korean KKuTu/end-word type group.
- Cross-check: `Example Database/original_kkutu.sqlite` contains 440,004 rows in `word_list`, but `kor_list.txt` is the cleaner pre-extracted Korean gameplay word list.
- Runtime acceptance: Korean syllables, compatibility jamo, and digits are allowed so entries such as `자르반4세` and `ㄷ자형자물쇠` remain usable.

The Discord game loads `data/wordchain-ko.txt` directly at runtime.
