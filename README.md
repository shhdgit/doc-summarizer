# doc-summarizer

## Usage

Install deps
```
npm i
```

Create an environment variable file `.env` in current directory.

.env:
```
LANGLINK_ACCESS_KEY=
LANGLINK_ACCESS_SECRET=
LANGLINK_USER=

SUMMARIZED_PATH=../docs/benchmark/**/*
# OVERRIDE is used to overwrite a non-empty summary
# OVERRIDE=true
```

Summarize
```
node index.js
```
