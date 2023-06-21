import { diff_match_patch } from "diff-match-patch";
import { DateTime } from "luxon";
import escape from "markdown-escape";
import { parseYaml } from "obsidian";
import outOfCharacter from "out-of-character";
import { Highlight } from "./api";

export const DATE_FORMAT_W_OUT_SECONDS = "yyyy-MM-dd'T'HH:mm";
export const DATE_FORMAT = `${DATE_FORMAT_W_OUT_SECONDS}:ss`;
export const REPLACEMENT_CHAR = "-";
// On Unix-like systems / is reserved and <>:"/\|?* as well as non-printable characters \u0000-\u001F on Windows
// credit: https://github.com/sindresorhus/filename-reserved-regex
// eslint-disable-next-line no-control-regex
export const ILLEGAL_CHAR_REGEX = /[<>:"/\\|?*\u0000-\u001F]/g;

export interface HighlightPoint {
  left: number;
  top: number;
}

export const getHighlightLocation = (patch: string): number => {
  const dmp = new diff_match_patch();
  const patches = dmp.patch_fromText(patch);
  return patches[0].start1 || 0;
};

export const getHighlightPoint = (patch: string): HighlightPoint => {
  const { bbox } = JSON.parse(patch) as { bbox: number[] };
  if (!bbox || bbox.length !== 4) {
    return { left: 0, top: 0 };
  }
  return { left: bbox[0], top: bbox[1] };
};

export const compareHighlightsInFile = (a: Highlight, b: Highlight): number => {
  // get the position of the highlight in the file
  const highlightPointA = getHighlightPoint(a.patch);
  const highlightPointB = getHighlightPoint(b.patch);
  if (highlightPointA.top === highlightPointB.top) {
    // if top is same, sort by left
    return highlightPointA.left - highlightPointB.left;
  }
  // sort by top
  return highlightPointA.top - highlightPointB.top;
};

export const markdownEscape = (text: string): string => {
  try {
    return escape(text);
  } catch (e) {
    console.error("markdownEscape error", e);
    return text;
  }
};

export const escapeQuotationMarks = (text: string): string => {
  return text.replace(/"/g, '\\"');
};

export const parseDateTime = (str: string): DateTime => {
  const res = DateTime.fromFormat(str, DATE_FORMAT);
  if (res.isValid) {
    return res;
  }
  return DateTime.fromFormat(str, DATE_FORMAT_W_OUT_SECONDS);
};

export const wrapAround = (value: number, size: number): number => {
  return ((value % size) + size) % size;
};

export const unicodeSlug = (str: string, savedAt: string) => {
  return (
    str
      .normalize("NFKD") // using NFKD method returns the Unicode Normalization Form of a given string.
      .replace(/[\u0300-\u036f]/g, "") // remove all previously split accents
      .trim()
      .toLowerCase()
      .replace(
        /[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,./:;<=>?@[\]^`{|}~]/g,
        ""
      ) // replace all the symbols with -
      .replace(/\s+/g, "-") // collapse whitespace and replace by -
      .replace(/_/g, "-") // replace _ with -
      .replace(/-+/g, "-") // collapse dashes
      // remove trailing -
      .replace(/-$/g, "")
      .substring(0, 64) +
    "-" +
    new Date(savedAt).getTime().toString(16)
  );
};

export const replaceIllegalChars = (str: string): string => {
  return removeInvisibleChars(
    str.replace(ILLEGAL_CHAR_REGEX, REPLACEMENT_CHAR)
  );
};

export function formatDate(date: string, format: string): string {
  if (isNaN(Date.parse(date))) {
    throw new Error(`Invalid date: ${date}`);
  }
  return DateTime.fromJSDate(new Date(date)).toFormat(format);
}

export const getQueryFromFilter = (
  filter: string,
  customQuery: string
): string => {
  switch (filter) {
    case "ALL":
      return "";
    case "HIGHLIGHTS":
      return `has:highlights`;
    case "ADVANCED":
      return customQuery;
    default:
      return "";
  }
};

export const siteNameFromUrl = (originalArticleUrl: string): string => {
  try {
    return new URL(originalArticleUrl).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

export const formatHighlightQuote = (
  quote: string,
  template: string
): string => {
  // if the template has highlights, we need to preserve paragraphs
  const regex = /{{#highlights}}(\n)*>/gm;
  if (regex.test(template)) {
    // replace all empty lines with blockquote '>' to preserve paragraphs
    quote = quote.replaceAll("&gt;", ">").replaceAll(/\n/gm, "\n> ");
  }

  return quote;
};

export const findFrontMatterIndex = (
  frontMatter: any[],
  id: string
): number => {
  // find index of front matter with matching id
  return frontMatter.findIndex((fm) => fm.id == id);
};

export const parseFrontMatterFromContent = (content: string) => {
  // get front matter yaml from content
  const frontMatter = content.match(/^---\n(.*?)\n---/s);
  if (!frontMatter) {
    return undefined;
  }
  // parse yaml
  return parseYaml(frontMatter[1]);
};

export const removeFrontMatterFromContent = (content: string): string => {
  const frontMatterRegex = /^---.*?---\n*/s;

  return content.replace(frontMatterRegex, "");
};

export const snakeToCamelCase = (str: string) =>
  str.replace(/(_[a-z])/g, (group) => group.toUpperCase().replace("_", ""));

const removeInvisibleChars = (str: string): string => {
  return outOfCharacter.replace(str);
};
