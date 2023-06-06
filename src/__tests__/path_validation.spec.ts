import * as fs from "fs";
import {
  ILLEGAL_CHAR_REGEX,
  replaceIllegalChars,
  REPLACEMENT_CHAR,
} from "../util";

const expectedManualIllegalChars: string[] = [
  "/",
  "\\",
  "?",
  "*",
  ":",
  "|",
  '"',
  "<",
  ">",
  "\u0000",
];

describe("replaceIllegalChars() removes all expected characters", () => {
  test.each(expectedManualIllegalChars)(
    'Illegal character "%s" is removed',
    (character) => {
      const input = `this${character}string`;
      const output = replaceIllegalChars(input);
      expect(output).not.toContain(character);
    }
  );
});

describe("replaceIllegalChars() function replaces illegal characters with replacement char", () => {
  test.each(expectedManualIllegalChars)(
    "Illegal character '%s' is replaced",
    (char) => {
      const input = `this${char}string`;
      const expectedOutput = `this${REPLACEMENT_CHAR}string`;
      const output = replaceIllegalChars(input);
      expect(output).toEqual(expectedOutput);
    }
  );
});

describe("replaceIllegalChars() function does not modify string without illegal characters", () => {
  test.each(["this_is_a_valid_string", "this is a valid string"])(
    "String '%s' is not modified",
    (input) => {
      const output = replaceIllegalChars(input);
      expect(output).toEqual(input);
    }
  );
});

describe("replaceIllegalChars() function handles empty string", () => {
  test("Empty string is not modified", () => {
    const input = "";
    const output = replaceIllegalChars(input);
    expect(output).toEqual(input);
  });
});

describe("replaceIllegalChars() function replaces all occurrences of illegal characters", () => {
  test.each(expectedManualIllegalChars)(
    "Illegal character '%s' is replaced",
    (char) => {
      const input = `${char}foo${char}bar`;
      const expectedOutput = `${REPLACEMENT_CHAR}foo${REPLACEMENT_CHAR}bar`;
      const output = replaceIllegalChars(input);
      expect(output).toEqual(expectedOutput);
      expect(output.match(ILLEGAL_CHAR_REGEX)).toBeNull();
    }
  );
});

describe("file system behavior with non-alphanumeric characters not in the illegal character list", () => {
  const nonAlphanumericCharactersWithoutIllegal: string[] = Array.from(
    { length: 127 - 32 },
    (_, i) => String.fromCharCode(i + 32)
  )
    .filter((char) => !/^[a-zA-Z0-9]+$/.test(char))
    .map(replaceIllegalChars);

  test.each(nonAlphanumericCharactersWithoutIllegal)(
    "File system allows creation of file with character '%s'",
    (char) => {
      const input = `test${char}test.txt`;
      // verify file does not already exist
      expect(fs.existsSync(input)).toBe(false);
      fs.writeFileSync(input, "test");
      // verify the file exists
      expect(fs.existsSync(input)).toBe(true);
      // remove the file
      fs.unlinkSync(input);
      // verify the file has been deleted
      expect(fs.existsSync(input)).toBe(false);
    }
  );
});
