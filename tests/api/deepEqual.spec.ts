import { describe, test, expect } from "@jest/globals";
import deepEqual from "@/util/deepEqual";

describe("Primitives", () => {

  const s1 = "Hello";
  const s2 = "Hello";
  const s3 = "World";
  const s4 = "";
  test("Strings", () => {
    expect(deepEqual(s1, s2)).toEqual(true);
    expect(deepEqual(s1, s3)).toEqual(false);
    expect(deepEqual(s1, s4)).toEqual(false);
    expect(deepEqual(s4, "")).toEqual(true);
  });

  const n1 = 10;
  const n2 = 10;
  const n3 = 0;
  const n4 = 1;
  const n5 = -1;
  const n6 = -10;
  test("Numbers", () => {
    expect(deepEqual(n1, n2)).toEqual(true);
    expect(deepEqual(n1, n6)).toEqual(false);
    expect(deepEqual(n1, n3)).toEqual(false);
    expect(deepEqual(n1, n4)).toEqual(false);
    expect(deepEqual(n5, n3)).toEqual(false);
    expect(deepEqual(n3, n3)).toEqual(true);
    expect(deepEqual(n4, n4)).toEqual(true);
  });

  const b1 = true;
  const b2 = true;
  const b3 = false;
  const b4 = false;
  test("Booleans", () => {
    expect(deepEqual(b1, b2)).toEqual(true);
    expect(deepEqual(b2, b3)).toEqual(false);
    expect(deepEqual(b3, b4)).toEqual(true);
  });

});

describe("1d Arrays", () => {

  const a = [1, 2, 3, 4, 5];
  const b = [1, 2, 3, 4, 5];
  const c = [5, 4, 3, 2, 1];
  const i = [6, 7, 8, 9, 10];
  const d = [1, 2, 3];
  const e = [4, 5, 6];
  const f = [1, 2, 3, 4];
  const g = [] as number[]; // hush, ts.
  const h = [] as number[];
  const j = [1];

  test("Same length, same elements", () => {
    expect(deepEqual(a, b)).toBe(true);
    expect(deepEqual(d, d)).toBe(true);
  });

  test("Same length, different elements", () => {
    expect(deepEqual(a, c)).toBe(true);
    expect(deepEqual(a, i)).toBe(false);
    expect(deepEqual(d, e)).toBe(false);
  });

  test("Different lengths", () => {
    expect(deepEqual(a, d)).toBe(false);
    expect(deepEqual(a, f)).toBe(false);
    expect(deepEqual(d, f)).toBe(false);
    expect(deepEqual(a, j)).toBe(false);
  });

  test("Empty arrays", () => {
    expect(deepEqual(g, h)).toBe(true);
    expect(deepEqual(g, a as typeof g)).toBe(false);
    expect(deepEqual(a, g as typeof a)).toBe(false);
  });

  test("Single element arrays", () => {
    expect(deepEqual(j, j)).toBe(true);
    expect(deepEqual(j, [1])).toBe(true);
    expect(deepEqual(j, [2])).toBe(false);
  });

  const str1 = ["hello", "world"];
  const str2 = ["hello", "world"];
  const str3 = ["world", "hello"];
  const str4 = ["hello", "World"];
  
  test("String arrays", () => {
    expect(deepEqual(str1, str2)).toBe(true);
    expect(deepEqual(str1, str3)).toBe(true);
    expect(deepEqual(str1, str4)).toBe(false);
  });
});

describe("2d Arrays", () => {

  // Basic 2D arrays - number arrays
  const arr1 = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
  const arr2 = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
  const arr3 = [[3, 2, 1], [6, 5, 4], [9, 8, 7]]; // Same rows, different order within rows
  const arr4 = [[7, 8, 9], [4, 5, 6], [1, 2, 3]]; // Different row order
  const arr5 = [[1, 2, 3], [7, 8, 9], [4, 5, 6]]; // Different row order

  test("Same rows, same order within rows", () => {
    expect(deepEqual(arr1, arr2)).toBe(true);
  });

  test("Same rows, different order within rows", () => {
    expect(deepEqual(arr1, arr3)).toBe(true);
  });

  test("Different row positions", () => {
    expect(deepEqual(arr1, arr4)).toBe(false);
    expect(deepEqual(arr1, arr5)).toBe(false);
  });

  // Different lengths
  const arr6 = [[1, 2, 3], [4, 5, 6]];
  const arr7 = [[1, 2, 3]];
  const arr8 = [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]];

  test("Different number of rows", () => {
    expect(deepEqual(arr1, arr6)).toBe(false);
    expect(deepEqual(arr1, arr7)).toBe(false);
    expect(deepEqual(arr1, arr8)).toBe(false);
  });

  // Different row lengths
  const arr9 = [[1, 2], [4, 5, 6], [7, 8, 9]];
  const arr10 = [[1, 2, 3], [4, 5], [7, 8, 9]];
  const arr11 = [[1, 2, 3], [4, 5, 6], [7, 8]];

  test("Different lengths within rows", () => {
    expect(deepEqual(arr1, arr9)).toBe(false);
    expect(deepEqual(arr1, arr10)).toBe(false);
    expect(deepEqual(arr1, arr11)).toBe(false);
  });

  // Different values in specific rows
  const arr12 = [[1, 2, 3], [4, 5, 6], [7, 8, 10]]; // Last row different
  const arr13 = [[1, 2, 3], [4, 5, 7], [7, 8, 9]]; // Middle row different
  const arr14 = [[1, 2, 4], [4, 5, 6], [7, 8, 9]]; // First row different

  test("Different values in specific rows", () => {
    expect(deepEqual(arr1, arr12)).toBe(false);
    expect(deepEqual(arr1, arr13)).toBe(false);
    expect(deepEqual(arr1, arr14)).toBe(false);
  });

  // Empty arrays
  const empty1 = [[]];
  const empty2 = [[]];
  const empty3 = [[], []];
  const empty4 = [] as number[][];

  test("Empty 2D arrays", () => {
    expect(deepEqual(empty1, empty2)).toBe(true);
    expect(deepEqual(empty1, empty3)).toBe(false);
    expect(deepEqual(empty4, empty4)).toBe(true);
    expect(deepEqual(empty1, empty4)).toBe(false);
  });

  // String 2D arrays
  const strArr1 = [["a", "b", "c"], ["d", "e", "f"]];
  const strArr2 = [["c", "b", "a"], ["f", "e", "d"]]; // Same content, different order within rows
  const strArr3 = [["d", "e", "f"], ["a", "b", "c"]]; // Different row positions
  const strArr4 = [["a", "b", "c"], ["d", "e", "F"]]; // Different case in last element

  test("String 2D arrays", () => {
    expect(deepEqual(strArr1, strArr2)).toBe(true);
    expect(deepEqual(strArr1, strArr3)).toBe(false);
    expect(deepEqual(strArr1, strArr4)).toBe(false);
  });

  // Single row arrays
  const single1 = [[1, 2, 3, 4, 5]];
  const single2 = [[5, 4, 3, 2, 1]];
  const single3 = [[1, 2, 3, 4, 6]];

  test("Single row 2D arrays", () => {
    expect(deepEqual(single1, single2)).toBe(true);
    expect(deepEqual(single1, single3)).toBe(false);
  });

  // Complex scenarios
  const complex1 = [[1], [2], [3]];
  const complex2 = [[1], [2], [3]];
  const complex3 = [[3], [2], [1]];
  const complex4 = [[1, 1], [2, 2], [3, 3]];

  test("Single element rows", () => {
    expect(deepEqual(complex1, complex2)).toBe(true);
    expect(deepEqual(complex1, complex3)).toBe(false);
    expect(deepEqual(complex1, complex4)).toBe(false);
  });

  // Rows with duplicate elements
  const dup1 = [[1, 2, 2, 3], [4, 5, 5, 6]];
  const dup2 = [[2, 1, 3, 2], [5, 4, 6, 5]]; // Same elements, different order
  const dup3 = [[1, 2, 3, 3], [4, 5, 5, 6]]; // Different duplicates

  test("Rows with duplicate elements", () => {
    expect(deepEqual(dup1, dup2)).toBe(true);
    expect(deepEqual(dup1, dup3)).toBe(false);
  });

});

