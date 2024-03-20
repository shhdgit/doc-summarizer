# doc-summarizer

## Usage

Install deps
```
npm i
```

Create an environment variable file `.env` in current directory.

.env:
```
LANGLINK_APP_ID=
LANGLINK_ACCESS_KEY=
LANGLINK_ACCESS_SECRET=
LANGLINK_USER=

SUMMARIZED_PATH=../docs/benchmark/**/*
# FILE_FILTER=
# OVERRIDE is used to overwrite a non-empty summary
# OVERRIDE=true
# SUMMARY_WORD_COUNT=140
```

Summarize
```
node index.js
```
