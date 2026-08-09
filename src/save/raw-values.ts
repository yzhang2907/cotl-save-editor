export function rawValuesMatch(first: unknown, second: unknown): boolean {
  if (Object.is(first, second)) {
    return true;
  }
  if (
    first === null ||
    second === null ||
    typeof first !== "object" ||
    typeof second !== "object" ||
    Object.getPrototypeOf(first) !== Object.getPrototypeOf(second)
  ) {
    return false;
  }
  if (first instanceof Uint8Array && second instanceof Uint8Array) {
    return (
      first.byteLength === second.byteLength &&
      first.every((byte, index) => byte === second[index])
    );
  }
  if (first instanceof Date && second instanceof Date) {
    return first.getTime() === second.getTime();
  }
  if (Array.isArray(first) || Array.isArray(second)) {
    return (
      Array.isArray(first) &&
      Array.isArray(second) &&
      first.length === second.length &&
      first.every((value, index) =>
        rawValuesMatch(value, second[index]),
      )
    );
  }

  const firstKeys = Reflect.ownKeys(first);
  const secondKeys = Reflect.ownKeys(second);
  return (
    firstKeys.length === secondKeys.length &&
    firstKeys.every(
      (key, index) =>
        key === secondKeys[index] &&
        rawValuesMatch(
          (first as Record<PropertyKey, unknown>)[key],
          (second as Record<PropertyKey, unknown>)[key],
        ),
    )
  );
}
