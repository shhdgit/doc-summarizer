import { glob } from "glob";
import * as fs from "fs";
import path from "path";
import "dotenv/config";

// process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const errorFileList = [];

async function main() {
  if (!process.env.SUMMARIZED_PATH) {
    throw new Error(`Requires the correct environment variables.`);
  }

  const srcList = getMdFileList(process.env.SUMMARIZED_PATH);
  const summaryWithColonPaths = [];

  await Promise.all(
    srcList.map((filePath) => {
      return overrideSummary(filePath, summaryWithColonPaths);
    })
  );

  if (!!errorFileList.length) {
    console.log("-----------------------");
    console.log("Failed:");
    errorFileList.forEach((f) => console.log(f));
    console.log(`Retry by set FILE_FILTER=${errorFileList.join(",")}`);
  }

  if (!!summaryWithColonPaths.length) {
    console.log("-----------------------");
    console.log("Summary with colon paths:");
    summaryWithColonPaths.forEach((p) => console.log(p));
  }
}

const getMdFileList = (prefix) => {
  const fileFilter = process.env.FILE_FILTER
    ? process.env.FILE_FILTER.split(",")
    : [];
  const files = glob.sync(prefix + ".md");
  return fileFilter.length
    ? files.filter((f) => fileFilter.includes(f))
    : files;
};

const writeFileSync = (destPath, fileContent) => {
  const dir = path.dirname(destPath);

  if (!fs.existsSync(dir)) {
    // console.info(`Create empty dir: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(destPath, fileContent);
};

const overrideSummary = async (filePath, summaryWithColonPaths) => {
  console.log("====== start ======");
  console.log(filePath);

  const mdFileContent = fs.readFileSync(filePath).toString();
  const [meta, content] = splitMetaContent(mdFileContent);
  if (!meta || !content) {
    return;
  }

  const matcheSummary = summaryReg.exec(meta);
  if (
    matcheSummary &&
    (!process.env.OVERRIDE || !JSON.parse(process.env.OVERRIDE))
  ) {
    console.log("skip");
    return;
  }
  let data;
  try {
    data = await executeLangLinkApp(content);
  } catch {
    errorFileList.push(filePath);
    return;
  }
  const result = replceSummary(meta, data);
  const contentWithMeta = `---\n${result}---\n${content}`;

  if (data.includes(":")) {
    summaryWithColonPaths.push(filePath);
  }

  console.log(filePath);
  console.log("====== end ======");

  writeFileSync(filePath, contentWithMeta);
};

const metaReg = /---\n/;

const splitMetaContent = (originalText) => {
  const [_, meta, ...content] = originalText.split(metaReg);
  if (!meta) {
    return [undefined, originalText];
  }
  return [meta, content.join("---\n")];
};

const summaryReg = /summary:\s(.*)/m;

const replceSummary = (meta, summary) => {
  const matches = summaryReg.exec(meta);
  if (!matches) {
    return `${meta}summary: ${summary}\n`;
  }
  return meta.replace(summaryReg, `summary: ${summary}`);
};

const LANGLINK_HEADERS = {
  "Content-Type": "application/json",
  "x-langlink-access-key": process.env.LANGLINK_ACCESS_KEY,
  "x-langlink-access-secret": process.env.LANGLINK_ACCESS_SECRET,
  "x-langlink-user": process.env.LANGLINK_USER,
};

const GPT35_APP_ID = process.env.LANGLINK_APP_ID;
const OUTPUT_NODE_ID =
  process.env.LANGLINK_OUTPUT_ID || "uXt40e3y1KhhHEKW-gmSN";
const RERUN_TIME = 3;
const RETRY_INTERVAL = 5000;
const RETRY_TIME = 12;

const executeLangLinkApp = (input) => {
  return new Promise((resolve, reject) => {
    const rerunLoop = async (rerunTime = 0) => {
      try {
        const result = await runLangLinkApp(input);
        resolve(result);
      } catch (e) {
        console.log(e);
        if (rerunTime < RERUN_TIME) {
          rerunLoop(++rerunTime);
        } else {
          reject(new Error(`Maximum rerun attempts reached: ${RERUN_TIME}.`));
        }
      }
    };
    rerunLoop();
  });
};

const runLangLinkApp = async (input) => {
  const res = await fetch(
    `https://langlink.pingcap.net/langlink-api/applications/${GPT35_APP_ID}/async`,
    {
      method: "POST",
      body: JSON.stringify({
        input: {
          content: input,
          word_count: process.env.SUMMARY_WORD_COUNT || 140,
        },
      }),
      headers: LANGLINK_HEADERS,
    }
  );
  const data = await res.json();
  const retryPromise = new Promise((resolve, reject) => {
    const getLangLinkResultLoop = async (retryTime = 0) => {
      let result;
      try {
        result = await getLangLinkResult(data.id);
      } catch (e) {
        reject(e);
        return;
      }
      if (!result.length) {
        if (retryTime < RETRY_TIME) {
          setTimeout(() => {
            getLangLinkResultLoop(++retryTime);
          }, RETRY_INTERVAL);
        } else {
          reject(new Error(`Maximum retry attempts reached: ${RETRY_TIME}.`));
        }
        return;
      }
      resolve(result.find((node) => node.block === OUTPUT_NODE_ID).output);
    };

    getLangLinkResultLoop();
  });

  return retryPromise;
};

const getLangLinkResult = async (id) => {
  const res = await fetch(
    `https://langlink.pingcap.net/langlink-api/applications/${GPT35_APP_ID}/debug/${id}`,
    {
      method: "GET",
      headers: LANGLINK_HEADERS,
    }
  );
  if (res.status !== 200) {
    const msg = await res.text();
    throw new Error(msg);
  }
  const data = await res.json();
  return data.debug;
};

main();
