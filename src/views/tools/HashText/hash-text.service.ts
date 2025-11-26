export function convertHexToBin(hex: string): string {
  return (
    hex
      .match(/.{1}/g)
      ?.map((d) => parseInt(d, 16).toString(2).padStart(4, "0"))
      .join("") ?? ""
  );
}

